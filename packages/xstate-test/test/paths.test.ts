import { createTestModel } from '../src';
import { createTestMachine } from '../src/machine';
import { testUtils } from '../src/testUtils';

const multiPathMachine = createTestMachine({
  initial: 'a',
  states: {
    a: {
      on: {
        EVENT: 'b'
      }
    },
    b: {
      on: {
        EVENT: 'c'
      }
    },
    c: {
      on: {
        EVENT: 'd',
        EVENT_2: 'e'
      }
    },
    d: {},
    e: {}
  }
});

describe('testModel.testPaths(...)', () => {
  it('custom path generators can be provided', async () => {
    const testModel = createTestModel(
      createTestMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: 'b'
            }
          },
          b: {}
        }
      })
    );

    const paths = testModel.getPaths({
      pathGenerator: (behavior, options) => {
        const events = options.getEvents?.(behavior.initialState) ?? [];

        const nextState = behavior.transition(behavior.initialState, events[0]);
        return [
          {
            state: nextState,
            steps: [
              {
                state: behavior.initialState,
                event: events[0]
              }
            ],
            weight: 1
          }
        ];
      }
    });

    await testUtils.testPaths(paths);
  });

  describe('When the machine only has one path', () => {
    it('Should only follow that path', () => {
      const machine = createTestMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: 'b'
            }
          },
          b: {
            on: {
              EVENT: 'c'
            }
          },
          c: {}
        }
      });

      const model = createTestModel(machine);

      const paths = model.getPaths();

      expect(paths).toHaveLength(1);
    });
  });

  describe('getSimplePaths', () => {
    it('Should dedup simple path paths', () => {
      const model = createTestModel(multiPathMachine);

      const paths = model.getSimplePaths();

      expect(paths).toHaveLength(2);
    });
  });
});

describe('path.description', () => {
  it('Should write a readable description including the target state and the path', () => {
    const model = createTestModel(multiPathMachine);

    const paths = model.getPaths();

    expect(paths.map((path) => path.description)).toEqual([
      'Reaches state "#(machine).d": EVENT → EVENT → EVENT',
      'Reaches state "#(machine).e": EVENT → EVENT → EVENT_2'
    ]);
  });
});
