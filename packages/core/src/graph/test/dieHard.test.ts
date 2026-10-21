import { z } from 'zod';
import { createMachine } from '../../index.ts';
import {
  getPathsFromEvents,
  getShortestPaths,
  getSimplePaths
} from '../index.ts';
import type { StatePath } from '../index.ts';

describe('die hard example', () => {
  class Jugs {
    public version = 0;
    public three = 0;
    public five = 0;

    public fillThree() {
      this.three = 3;
    }
    public fillFive() {
      this.five = 5;
    }
    public emptyThree() {
      this.three = 0;
    }
    public emptyFive() {
      this.five = 0;
    }
    public transferThree() {
      const poured = Math.min(5 - this.five, this.three);

      this.three = this.three - poured;
      this.five = this.five + poured;
    }
    public transferFive() {
      const poured = Math.min(3 - this.three, this.five);

      this.three = this.three + poured;
      this.five = this.five - poured;
    }
  }
  let jugs: Jugs;

  const dieHardMachine = createMachine({
    schemas: {
      context: z.object({
        three: z.number(),
        five: z.number()
      })
    },
    id: 'dieHard',
    initial: 'pending',
    context: { three: 0, five: 0 },
    states: {
      pending: {
        always: ({ context }) => {
          if (context.five === 4) {
            return {
              target: 'success'
            };
          }
        },
        on: {
          POUR_3_TO_5: ({ context }) => {
            const poured = Math.min(5 - context.five, context.three);

            return {
              context: {
                three: context.three - poured,
                five: context.five + poured
              }
            };
          },
          POUR_5_TO_3: ({ context }) => {
            const poured = Math.min(3 - context.three, context.five);

            return {
              context: {
                three: context.three + poured,
                five: context.five - poured
              }
            };
          },

          FILL_3: () => ({
            context: {
              three: 3
            }
          }),

          FILL_5: () => ({
            context: {
              five: 5
            }
          }),

          EMPTY_3: () => ({
            context: {
              three: 0
            }
          }),
          EMPTY_5: () => ({
            context: {
              five: 0
            }
          })
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  const actions: Record<string, () => void> = {
    POUR_3_TO_5: () => jugs.transferThree(),
    POUR_5_TO_3: () => jugs.transferFive(),
    EMPTY_3: () => jugs.emptyThree(),
    EMPTY_5: () => jugs.emptyFive(),
    FILL_3: () => jugs.fillThree(),
    FILL_5: () => jugs.fillFive()
  };

  /** Replays a path against the jugs and checks them after every step. */
  function replay(path: StatePath<any, any>) {
    for (const step of path.steps) {
      actions[step.event.type]?.();
      expect(jugs.three).toEqual(step.state.context.three);
      expect(jugs.five).toEqual(step.state.context.five);
    }
    expect(path.state.matches('success')).toBe(true);
    expect(jugs.five).toEqual(4);
  }

  function describePath(path: StatePath<any, any>): string {
    return path.steps.map((step) => step.event.type).join(' → ');
  }

  beforeEach(() => {
    jugs = new Jugs();
    jugs.version = Math.random();
  });

  describe('shortest paths to success', () => {
    const paths = getShortestPaths(dieHardMachine, {
      toState: (state) => state.matches('success')
    });

    it('should generate the right number of paths', () => {
      expect(paths.length).toEqual(2);
    });

    paths.forEach((path) => {
      it(`replays ${describePath(path)}`, () => {
        replay(path);
      });
    });
  });

  describe('simple paths to success', () => {
    const paths = getSimplePaths(dieHardMachine, {
      toState: (state) => state.matches('success')
    });

    it('should generate the right number of paths', () => {
      expect(paths.length).toEqual(14);
    });

    paths.forEach((path) => {
      it(`replays ${describePath(path)}`, () => {
        replay(path);
      });
    });
  });

  describe('paths from events', () => {
    const [path] = getPathsFromEvents(
      dieHardMachine,
      [
        { type: 'FILL_5' },
        { type: 'POUR_5_TO_3' },
        { type: 'EMPTY_3' },
        { type: 'POUR_5_TO_3' },
        { type: 'FILL_5' },
        { type: 'POUR_5_TO_3' }
      ],
      { toState: (state) => state.matches('success') }
    );

    it('replays the path', () => {
      replay(path);
    });

    it('should return no paths if the target does not match the last entered state', () => {
      const paths = getPathsFromEvents(dieHardMachine, [{ type: 'FILL_5' }], {
        toState: (state) => state.matches('success')
      });

      expect(paths).toHaveLength(0);
    });
  });

  describe('simple paths with a narrower target', () => {
    const paths = getSimplePaths(dieHardMachine, {
      toState: (state) => state.matches('success') && state.context.three === 0
    });

    it('should generate the right number of paths', () => {
      expect(paths.length).toEqual(6);
    });

    paths.forEach((path) => {
      it(`replays ${describePath(path)}`, () => {
        replay(path);
      });
    });
  });
});
