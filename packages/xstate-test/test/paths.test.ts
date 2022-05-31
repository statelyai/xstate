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

    const paths = testModel.getPaths({
      pathGenerator: (behavior, options) => {
        const events = options.getEvents?.(behavior.initialState, {}) ?? [];

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

    const paths = model.getPaths();

    expect(paths.map((path) => path.description)).toMatchInlineSnapshot(`
      Array [
        "Reaches state \\"#(machine).a\\": NEXT → PREV",
        "Reaches state \\"#(machine).a\\": NEXT → RESTART",
        "Reaches state \\"#(machine).b\\": END",
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

    const paths = model.getPaths({
      eventCases: {
        NEXT: [{ value: 0 }, { value: 100 }, { value: 1000 }]
      }
    });

    // { value: 1000 } already covered by first guarded transition
    expect(paths.map((path) => path.description)).toMatchInlineSnapshot(`
      Array [
        "Reaches state \\"#(machine).b\\": NEXT ({\\"value\\":0})",
        "Reaches state \\"#(machine).b\\": NEXT ({\\"value\\":100})",
        "Reaches state \\"#(machine).b\\": NEXT ({\\"value\\":1000})",
      ]
    `);
  });
});

it('Should find the most efficient path from the available options', () => {
  const machine = createTestMachine({
    initial: 'a',
    states: {
      a: {
        on: {
          NEXT: 'b'
        }
      },
      b: {
        on: {
          NEXT: 'c',
          BACK: 'a'
        }
      },
      c: {
        on: {
          BACK: 'b'
        }
      }
    }
  });

  const model = createTestModel(machine);

  const paths = model.getPaths();

  expect(paths.map((p) => p.description)).toEqual([
    `Reaches state "#(machine).a": NEXT → NEXT → BACK → BACK`
  ]);
});
