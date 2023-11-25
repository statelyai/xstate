import { createTestModel } from '../src';
import { createTestMachine } from '../src/machine';
import { testUtils } from './testUtils';

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

    const paths = testModel.getPaths((behavior, options) => {
      const events =
        typeof options.events === 'function'
          ? options.events(behavior.initialState)
          : options.events ?? [];

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
    });

    await testUtils.testPaths(paths, {});
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

      const paths = model.getShortestPaths();

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

    const paths = model.getShortestPaths();

    expect(paths.map((path) => path.description)).toEqual([
      'Reaches state "d": EVENT → EVENT → EVENT',
      'Reaches state "e": EVENT → EVENT → EVENT_2'
    ]);
  });
});

describe('transition coverage', () => {
  it('path generation should cover all transitions by default', () => {
    const machine = createTestMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b',
            END: 'b'
          }
        },
        b: {
          on: {
            PREV: 'a',
            RESTART: 'a'
          }
        }
      }
    });

    const model = createTestModel(machine);

    const paths = model.getShortestPaths();

    expect(paths.map((path) => path.description)).toMatchInlineSnapshot(`
      Array [
        "Reaches state \\"a\\": NEXT → PREV",
        "Reaches state \\"a\\": NEXT → RESTART",
        "Reaches state \\"b\\": END",
      ]
    `);
  });

  it('transition coverage should consider guarded transitions', () => {
    const machine = createTestMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: [{ cond: 'valid', target: 'b' }, { target: 'b' }]
            }
          },
          b: {}
        }
      },
      {
        guards: {
          valid: (_, event) => {
            return event.value > 10;
          }
        }
      }
    );

    const model = createTestModel(machine);

    const paths = model.getShortestPaths({
      events: [
        { type: 'NEXT', value: 0 },
        { type: 'NEXT', value: 100 },
        { type: 'NEXT', value: 1000 }
      ]
    });

    // { value: 1000 } already covered by first guarded transition
    expect(paths.map((path) => path.description)).toMatchInlineSnapshot(`
      Array [
        "Reaches state \\"b\\": NEXT ({\\"value\\":0}) → NEXT ({\\"value\\":0})",
        "Reaches state \\"b\\": NEXT ({\\"value\\":100})",
        "Reaches state \\"b\\": NEXT ({\\"value\\":1000})",
      ]
    `);
  });

  it('transition coverage should consider multiple transitions with the same target', () => {
    const machine = createTestMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO_TO_B: 'b',
            GO_TO_C: 'c'
          }
        },
        b: {
          on: {
            GO_TO_A: 'a'
          }
        },
        c: {
          on: {
            GO_TO_A: 'a'
          }
        }
      }
    });

    const model = createTestModel(machine);

    const paths = model.getShortestPaths();

    expect(paths.map((p) => p.description)).toEqual([
      `Reaches state "a": GO_TO_B → GO_TO_A`,
      `Reaches state "a": GO_TO_C → GO_TO_A`
    ]);
  });
});

describe('getShortestPathsTo', () => {
  const machine = createTestMachine({
    initial: 'open',
    states: {
      open: {
        on: {
          CLOSE: 'closed'
        }
      },
      closed: {
        on: {
          OPEN: 'open'
        }
      }
    }
  });
  it('Should find a path to a non-initial target state', () => {
    const closedPaths = createTestModel(machine).getShortestPaths({
      toState: (state) => state.matches('closed')
    });

    expect(closedPaths).toHaveLength(1);
  });

  it('Should find a path to an initial target state', () => {
    const openPaths = createTestModel(machine).getShortestPaths({
      toState: (state) => state.matches('open')
    });

    expect(openPaths).toHaveLength(1);
  });
});

describe('getShortestPathsFrom', () => {
  it('should get shortest paths from array of paths', () => {
    const machine = createTestMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b', OTHER: 'b', TO_C: 'c', TO_D: 'd', TO_E: 'e' }
        },
        b: {
          on: {
            TO_C: 'c',
            TO_D: 'd'
          }
        },
        c: {},
        d: {},
        e: {}
      }
    });
    const model = createTestModel(machine);
    const pathsToB = model.getShortestPaths({
      toState: (state) => state.matches('b')
    });

    // a (NEXT) -> b
    // a (OTHER) -> b
    expect(pathsToB).toHaveLength(2);

    const shortestPaths = model.getShortestPathsFrom(pathsToB);

    // a (NEXT) -> b (TO_C) -> c
    // a (OTHER) -> b (TO_C) -> c
    // a (NEXT) -> b (TO_D) -> d
    // a (OTHER) -> b (TO_D) -> d
    expect(shortestPaths).toHaveLength(4);

    expect(shortestPaths.every((path) => path.steps.length === 2)).toBeTruthy();
  });

  describe('getSimplePathsFrom', () => {
    it('should get simple paths from array of paths', () => {
      const machine = createTestMachine({
        initial: 'a',
        states: {
          a: {
            on: { NEXT: 'b', OTHER: 'b', TO_C: 'c', TO_D: 'd', TO_E: 'e' }
          },
          b: {
            on: {
              TO_C: 'c',
              TO_D: 'd'
            }
          },
          c: {},
          d: {},
          e: {}
        }
      });
      const model = createTestModel(machine);
      const pathsToB = model.getSimplePaths({
        toState: (state) => state.matches('b')
      });

      // a (NEXT) -> b
      // a (OTHER) -> b
      expect(pathsToB).toHaveLength(2);

      const simplePaths = model.getSimplePathsFrom(pathsToB);

      // a (NEXT) -> b (TO_C) -> c
      // a (OTHER) -> b (TO_C) -> c
      // a (NEXT) -> b (TO_D) -> d
      // a (OTHER) -> b (TO_D) -> d
      expect(simplePaths).toHaveLength(4);

      expect(simplePaths.every((path) => path.steps.length === 2)).toBeTruthy();
    });
  });
});
