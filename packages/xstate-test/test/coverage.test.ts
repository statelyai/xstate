import { createTestModel } from '../src';
import { createMachine } from 'xstate';
import { allStates, allTransitions } from '../src/coverage';

describe('coverage', () => {
  it('reports missing state node coverage', async () => {
    const machine = createMachine({
      id: 'test',
      initial: 'first',
      states: {
        first: {
          on: { NEXT: 'third' }
        },
        secondMissing: {},
        third: {
          initial: 'one',
          states: {
            one: {
              on: {
                NEXT: 'two'
              }
            },
            two: {},
            threeMissing: {}
          }
        }
      }
    });

    const testModel = createTestModel(machine);

    const plans = testModel.getShortestPlans();

    for (const plan of plans) {
      await testModel.testPlan(plan, undefined);
    }

    expect(
      testModel
        .getCoverage(allStates())
        .filter((c) => c.status !== 'covered')
        .map((c) => c.criterion.description)
    ).toMatchInlineSnapshot(`
      Array [
        "Visits \\"test.secondMissing\\"",
        "Visits \\"test.third.threeMissing\\"",
      ]
    `);

    expect(() => testModel.testCoverage(allStates()))
      .toThrowErrorMatchingInlineSnapshot(`
      "Coverage criteria not met:
      	Visits \\"test.secondMissing\\"
      	Visits \\"test.third.threeMissing\\""
    `);
  });

  // https://github.com/statelyai/xstate/issues/729
  it('reports full coverage when all states are covered', async () => {
    const feedbackMachine = createMachine({
      id: 'feedback',
      initial: 'logon',
      states: {
        logon: {
          initial: 'empty',
          states: {
            empty: {
              on: {
                ENTER_LOGON: 'filled'
              }
            },
            filled: { type: 'final' }
          },
          on: {
            LOGON_SUBMIT: 'ordermenu'
          }
        },
        ordermenu: {
          type: 'final'
        }
      }
    });

    const model = createTestModel(feedbackMachine);

    for (const plan of model.getShortestPlans()) {
      await model.testPlan(plan);
    }

    const coverage = model.getCoverage(allStates());

    expect(coverage).toHaveLength(5);

    expect(coverage.filter((c) => c.status !== 'covered')).toHaveLength(0);

    expect(() => model.testCoverage(allStates())).not.toThrow();
  });

  it('skips filtered states (filter option)', async () => {
    const TestBug = createMachine({
      id: 'testbug',
      initial: 'idle',
      context: {
        retries: 0
      },
      states: {
        idle: {
          on: {
            START: 'passthrough'
          }
        },
        passthrough: {
          always: 'end'
        },
        end: {
          type: 'final'
        }
      }
    });

    const testModel = createTestModel(TestBug);

    const testPlans = testModel.getShortestPlans();

    const promises: any[] = [];
    testPlans.forEach((plan) => {
      plan.paths.forEach(() => {
        promises.push(testModel.testPlan(plan, undefined));
      });
    });

    await Promise.all(promises);

    expect(() => {
      testModel.testCoverage(
        allStates({
          filter: (stateNode) => {
            return stateNode.key !== 'passthrough';
          }
        })
      );
    }).not.toThrow();
  });

  // https://github.com/statelyai/xstate/issues/981
  it.skip('skips transient states (type: final)', async () => {
    const machine = createMachine({
      id: 'menu',
      initial: 'initial',
      states: {
        initial: {
          initial: 'inner1',

          states: {
            inner1: {
              on: {
                INNER2: 'inner2'
              }
            },

            inner2: {
              on: {
                DONE: 'done'
              }
            },

            done: {
              type: 'final'
            }
          },

          onDone: 'later'
        },

        later: {}
      }
    });

    const model = createTestModel(machine);
    const shortestPlans = model.getShortestPlans();

    for (const plan of shortestPlans) {
      await model.testPlan(plan);
    }

    // TODO: determine how to handle missing coverage for transient states,
    // which arguably should not be counted towards coverage, as the app is never in
    // a transient state for any length of time
    model.testCoverage(allStates());
  });

  it('tests transition coverage', async () => {
    const model = createTestModel(
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT_ONE: 'b',
              EVENT_TWO: 'b'
            }
          },
          b: {}
        }
      })
    );

    await model.testPlans(model.getShortestPlans());

    expect(() => {
      model.testCoverage(allTransitions());
    }).toThrowErrorMatchingInlineSnapshot(`
      "Coverage criteria not met:
      	Transitions a on event EVENT_TWO"
    `);

    await model.testPlans(model.getSimplePlans());

    expect(() => {
      model.testCoverage(allTransitions());
    }).not.toThrow();
  });
});
