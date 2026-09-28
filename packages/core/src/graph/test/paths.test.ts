import { createMachine } from '../../index.ts';
import { getShortestPaths, getSimplePaths, joinPaths } from '../index.ts';
import type { StatePath } from '../index.ts';

const multiPathMachine = createMachine({
  initial: 'a',
  states: {
    a: {
      on: {
        EVENT: { target: 'b' }
      }
    },
    b: {
      on: {
        EVENT: { target: 'c' }
      }
    },
    c: {
      on: {
        EVENT: { target: 'd' },
        EVENT_2: { target: 'e' }
      }
    },
    d: {},
    e: {}
  }
});

function eventTypes(path: StatePath<any, any>): string {
  return path.steps.map((step) => step.event.type).join(' → ');
}

describe('getSimplePaths', () => {
  it('returns one path per reachable state', () => {
    const paths = getSimplePaths(multiPathMachine);

    expect(paths).toHaveLength(5);
  });

  it('should support filtering disabled events', () => {
    const machine = createMachine({
      id: 'guarded-test-model',
      initial: 'start',
      context: { allowed: false as boolean },
      states: {
        start: {
          on: { NEXT: { target: 'idle' } }
        },
        idle: {
          on: {
            PROCEED: ({ context }) => {
              if (context.allowed) {
                return { target: 'done' };
              }
            },
            ALLOW: () => ({
              context: {
                allowed: true
              }
            })
          }
        },
        done: {
          type: 'final'
        }
      }
    });

    const paths = getSimplePaths(machine, {
      filterEvents: (state, event) => state.can(event),
      toState: (state) => state.status === 'done'
    });

    expect(paths.map(eventTypes)).toEqual([
      '@xstate.init → NEXT → ALLOW → PROCEED'
    ]);
  });
});

describe('transition coverage', () => {
  it('shortest paths reach every state', () => {
    const paths = getShortestPaths(multiPathMachine);

    expect(paths.map((path) => path.state.value)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e'
    ]);
    expect(paths.map(eventTypes)).toContain(
      '@xstate.init → EVENT → EVENT → EVENT_2'
    );
  });

  it('transition coverage should consider multiple transitions with the same target', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO_TO_B: { target: 'b' },
            GO_TO_C: { target: 'c' }
          }
        },
        b: {
          on: {
            GO_TO_A: { target: 'a' }
          }
        },
        c: {
          on: {
            GO_TO_A: { target: 'a' }
          }
        }
      }
    });

    const paths = getSimplePaths(machine);

    expect(paths.map(eventTypes)).toEqual(
      expect.arrayContaining([
        '@xstate.init → GO_TO_B',
        '@xstate.init → GO_TO_C'
      ])
    );
  });
});

describe('toState', () => {
  const machine = createMachine({
    initial: 'open',
    states: {
      open: {
        on: {
          CLOSE: { target: 'closed' }
        }
      },
      closed: {
        on: {
          OPEN: { target: 'open' }
        }
      }
    }
  });

  it('Should find a path to a non-initial target state', () => {
    const closedPaths = getShortestPaths(machine, {
      toState: (state) => state.matches('closed')
    });

    expect(closedPaths).toHaveLength(1);
  });

  it('Should find a path to an initial target state', () => {
    const openPaths = getShortestPaths(machine, {
      toState: (state) => state.matches('open')
    });

    expect(openPaths).toHaveLength(1);
  });
});

describe('paths from paths', () => {
  const machine = createMachine({
    initial: 'a',
    states: {
      a: {
        on: {
          NEXT: { target: 'b' },
          OTHER: { target: 'b' },
          TO_C: { target: 'c' },
          TO_D: { target: 'd' },
          TO_E: { target: 'e' }
        }
      },
      b: {
        on: {
          TO_C: { target: 'c' },
          TO_D: { target: 'd' }
        }
      },
      c: {},
      d: {},
      e: {}
    }
  });

  it('should join shortest paths from the end of other paths', () => {
    const pathsToB = getSimplePaths(machine, {
      toState: (state) => state.matches('b')
    });

    // a (NEXT) -> b
    // a (OTHER) -> b
    expect(pathsToB).toHaveLength(2);

    const joined = pathsToB.flatMap((path) =>
      getShortestPaths(machine, {
        fromState: path.state,
        toState: (state) => state.matches('c') || state.matches('d')
      }).map((next) => joinPaths(path, next))
    );

    // a (NEXT) -> b (TO_C) -> c
    // a (OTHER) -> b (TO_C) -> c
    // a (NEXT) -> b (TO_D) -> d
    // a (OTHER) -> b (TO_D) -> d
    expect(joined).toHaveLength(4);
    expect(joined.every((path) => path.steps.length === 3)).toBeTruthy();
  });
});
