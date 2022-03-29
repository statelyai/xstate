import { createTestModel } from '../src';
import { assign, createMachine, interpret } from 'xstate';
import { getDescription } from '../src/utils';
import { coversAllStates } from '../src/coverage';

describe('events', () => {
  it('should allow for representing many cases', async () => {
    type Events =
      | { type: 'CLICK_BAD' }
      | { type: 'CLICK_GOOD' }
      | { type: 'CLOSE' }
      | { type: 'ESC' }
      | { type: 'SUBMIT'; value: string };
    const feedbackMachine = createMachine({
      id: 'feedback',
      schema: {
        events: {} as Events
      },
      initial: 'question',
      states: {
        question: {
          on: {
            CLICK_GOOD: 'thanks',
            CLICK_BAD: 'form',
            CLOSE: 'closed',
            ESC: 'closed'
          }
        },
        form: {
          on: {
            SUBMIT: [
              {
                target: 'thanks',
                cond: (_, e) => !!e.value.length
              },
              {
                target: '.invalid'
              }
            ],
            CLOSE: 'closed',
            ESC: 'closed'
          },
          initial: 'valid',
          states: {
            valid: {},
            invalid: {}
          }
        },
        thanks: {
          on: {
            CLOSE: 'closed',
            ESC: 'closed'
          }
        },
        closed: {
          type: 'final'
        }
      }
    });

    const testModel = createTestModel(feedbackMachine, {
      events: {
        SUBMIT: { cases: () => [{ value: 'something' }, { value: '' }] }
      }
    });

    const testPlans = testModel.getShortestPlans();

    for (const plan of testPlans) {
      await testModel.testPlan(plan);
    }

    expect(() => testModel.testCoverage(coversAllStates())).not.toThrow();
  });

  it('should not throw an error for unimplemented events', () => {
    const testMachine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { ACTIVATE: 'active' }
        },
        active: {}
      }
    });

    const testModel = createTestModel(testMachine);

    const testPlans = testModel.getShortestPlans();

    expect(async () => {
      for (const plan of Object.values(testPlans)) {
        await testModel.testPlan(plan);
      }
    }).not.toThrow();
  });
});

describe('state limiting', () => {
  it('should limit states with filter option', () => {
    const machine = createMachine<{ count: number }>({
      initial: 'counting',
      context: { count: 0 },
      states: {
        counting: {
          on: {
            INC: {
              actions: assign({
                count: (ctx) => ctx.count + 1
              })
            }
          }
        }
      }
    });

    const testModel = createTestModel(machine);

    const testPlans = testModel.getShortestPlans({
      filter: (state) => {
        return state.context.count < 5;
      }
    });

    expect(testPlans).toHaveLength(5);
  });
});

describe('plan description', () => {
  const machine = createMachine({
    id: 'test',
    initial: 'atomic',
    context: { count: 0 },
    states: {
      atomic: {
        on: { NEXT: 'compound', DONE: 'final' }
      },
      final: {
        type: 'final'
      },
      compound: {
        initial: 'child',
        states: {
          child: {
            on: {
              NEXT: 'childWithMeta'
            }
          },
          childWithMeta: {
            meta: {
              description: 'child with meta'
            }
          }
        },
        on: {
          NEXT: 'parallel'
        }
      },
      parallel: {
        type: 'parallel',
        states: {
          one: {},
          two: {
            meta: {
              description: 'two description'
            }
          }
        },
        on: {
          NEXT: 'noMetaDescription'
        }
      },
      noMetaDescription: {
        meta: {}
      }
    }
  });

  const testModel = createTestModel(machine);
  const testPlans = testModel.getShortestPlans();

  it('should give a description for every plan', () => {
    const planDescriptions = testPlans.map(
      (plan) => `reaches ${getDescription(plan.state)}`
    );

    expect(planDescriptions).toMatchInlineSnapshot(`
      Array [
        "reaches state: \\"#test.atomic\\" ({\\"count\\":0})",
        "reaches state: \\"#test.compound.child\\" ({\\"count\\":0})",
        "reaches state: \\"#test.final\\" ({\\"count\\":0})",
        "reaches state: \\"child with meta\\" ({\\"count\\":0})",
        "reaches states: \\"#test.parallel.one\\", \\"two description\\" ({\\"count\\":0})",
        "reaches state: \\"noMetaDescription\\" ({\\"count\\":0})",
      ]
    `);
  });
});

// https://github.com/statelyai/xstate/issues/1935
it('prevents infinite recursion based on a provided limit', () => {
  const machine = createMachine<{ count: number }>({
    id: 'machine',
    context: {
      count: 0
    },
    on: {
      TOGGLE: {
        actions: assign({ count: (ctx) => ctx.count + 1 })
      }
    }
  });

  const model = createTestModel(machine);

  expect(() => {
    model.getShortestPlans({ traversalLimit: 100 });
  }).toThrowErrorMatchingInlineSnapshot(`"Traversal limit exceeded"`);
});

// TODO: have this as an opt-in
it('executes actions', async () => {
  let executedActive = false;
  let executedDone = false;
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          TOGGLE: { target: 'active', actions: 'boom' }
        }
      },
      active: {
        entry: () => {
          executedActive = true;
        },
        on: { TOGGLE: 'done' }
      },
      done: {
        entry: () => {
          executedDone = true;
        }
      }
    }
  });

  const model = createTestModel(machine);

  const testPlans = model.getShortestPlans();

  for (const plan of testPlans) {
    await model.testPlan(plan);
  }

  expect(executedActive).toBe(true);
  expect(executedDone).toBe(true);
});

describe('test model options', () => {
  it('options.testState(...) should test state', async () => {
    const testedStates: any[] = [];

    const model = createTestModel(
      createMachine({
        initial: 'inactive',
        states: {
          inactive: {
            on: {
              NEXT: 'active'
            }
          },
          active: {}
        }
      }),
      {
        testState: (state) => {
          testedStates.push(state.value);
        }
      }
    );

    const plans = model.getShortestPlans();

    for (const plan of plans) {
      await model.testPlan(plan);
    }

    expect(testedStates).toEqual(['inactive', 'inactive', 'active']);
  });

  it('options.testTransition(...) should test transition', async () => {
    const testedEvents: any[] = [];

    const model = createTestModel(
      createMachine({
        initial: 'inactive',
        states: {
          inactive: {
            on: {
              NEXT: 'active'
            }
          },
          active: {
            on: {
              PREV: 'inactive'
            }
          }
        }
      }),
      {
        // Force traversal to consider all transitions
        serializeState: (state) =>
          ((state.value as any) + state.event.type) as any,
        testTransition: (step) => {
          testedEvents.push(step.event.type);
        }
      }
    );

    const plans = model.getShortestPlans();

    for (const plan of plans) {
      await model.testPlan(plan);
    }

    expect(testedEvents).toEqual(['NEXT', 'NEXT', 'PREV']);
  });

  it('options.beforePath(...) executes before each path is tested', async () => {
    const counts: number[] = [];
    let count = 0;

    const testModel = createTestModel(
      createMachine({
        initial: 'a',
        states: {
          a: {
            entry: () => {
              counts.push(count);
            },
            on: {
              TO_B: 'b',
              TO_C: 'c'
            }
          },
          b: {},
          c: {}
        }
      }),
      {
        beforePath: () => {
          count++;
        }
      }
    );

    const shortestPlans = testModel.getShortestPlans();

    await testModel.testPlans(shortestPlans);

    expect(counts).toEqual([1, 2, 3]);
  });

  it('options.afterPath(...) executes before each path is tested', async () => {
    const counts: number[] = [];
    let count = 0;

    const testModel = createTestModel(
      createMachine({
        initial: 'a',
        states: {
          a: {
            entry: () => {
              counts.push(count);
            },
            on: {
              TO_B: 'b',
              TO_C: 'c'
            }
          },
          b: {},
          c: {}
        }
      }),
      {
        afterPath: () => {
          count++;
        }
      }
    );

    const shortestPlans = testModel.getShortestPlans();

    await testModel.testPlans(shortestPlans);

    expect(counts).toEqual([0, 1, 2]);
  });
});

describe('invocations', () => {
  it.skip('invokes', async () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            START: 'pending'
          }
        },
        pending: {
          invoke: {
            src: (_, e) => new Promise((res) => res(e.value)),
            onDone: [
              { cond: (_, e) => e.data === 42, target: 'success' },
              { target: 'failure' }
            ]
          }
        },
        success: {},
        failure: {}
      }
    });

    const model = createTestModel(machine, {
      events: {
        START: {
          cases: () => [
            { type: 'START', value: 42 },
            { type: 'START', value: 1 }
          ]
        }
      }
    });

    const plans = model.getShortestPlans();

    for (const plan of plans) {
      for (const path of plan.paths) {
        const service = interpret(machine).start();

        await model.testPath(path, {
          testState: (state) => {
            return new Promise<void>((res) => {
              let actualState;
              const t = setTimeout(() => {
                throw new Error(
                  `expected ${state.value}, got ${actualState.value}`
                );
              }, 1000);
              service.subscribe((s) => {
                actualState = s;
                if (s.matches(state.value)) {
                  clearTimeout(t);
                  res();
                }
              });
            });
          },
          testTransition: (step) => {
            if (step.event.type.startsWith('done.')) {
              return;
            }

            service.send(step.event);
          }
        });
      }
    }

    model.testCoverage(coversAllStates());
  });
});

// https://github.com/statelyai/xstate/issues/1538
it('tests transitions', async () => {
  expect.assertions(2);
  const machine = createMachine({
    initial: 'first',
    states: {
      first: {
        on: { NEXT: 'second' }
      },
      second: {}
    }
  });

  const model = createTestModel(machine, {
    events: {
      NEXT: {
        exec: (step) => {
          expect(step).toHaveProperty('event');
          expect(step).toHaveProperty('state');
        }
      }
    }
  });

  const plans = model.getShortestPlansTo((state) => state.matches('second'));

  const path = plans[0].paths[0];

  await model.testPath(path);
});

// https://github.com/statelyai/xstate/issues/982
it('Event in event executor should contain payload from case', async () => {
  const machine = createMachine({
    initial: 'first',
    states: {
      first: {
        on: { NEXT: 'second' }
      },
      second: {}
    }
  });

  const obj = {};

  const nonSerializableData = () => 42;

  const model = createTestModel(machine, {
    events: {
      NEXT: {
        cases: () => [{ payload: 10, fn: nonSerializableData }],
        exec: (step) => {
          expect(step.event).toEqual({
            type: 'NEXT',
            payload: 10,
            fn: nonSerializableData
          });
        }
      }
    }
  });

  const plans = model.getShortestPlansTo((state) => state.matches('second'));

  const path = plans[0].paths[0];

  await model.testPath(path, obj);
});
