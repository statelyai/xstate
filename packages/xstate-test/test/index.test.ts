import { createTestModel } from '../src';
import { assign, createMachine, interpret } from 'xstate';
import { getDescription } from '../src/utils';
import { stateValueCoverage } from '../src/coverage';

interface DieHardContext {
  three: number;
  five: number;
}

const pour3to5 = assign<DieHardContext>((ctx) => {
  const poured = Math.min(5 - ctx.five, ctx.three);

  return {
    three: ctx.three - poured,
    five: ctx.five + poured
  };
});
const pour5to3 = assign<DieHardContext>((ctx) => {
  const poured = Math.min(3 - ctx.three, ctx.five);

  const res = {
    three: ctx.three + poured,
    five: ctx.five - poured
  };

  return res;
});
const fill3 = assign<DieHardContext>({ three: 3 });
const fill5 = assign<DieHardContext>({ five: 5 });
const empty3 = assign<DieHardContext>({ three: 0 });
const empty5 = assign<DieHardContext>({ five: 0 });

const dieHardMachine = createMachine<DieHardContext>(
  {
    id: 'dieHard',
    initial: 'pending',
    context: { three: 0, five: 0 },
    states: {
      pending: {
        always: {
          target: 'success',
          cond: 'weHave4Gallons'
        },
        on: {
          POUR_3_TO_5: {
            actions: pour3to5
          },
          POUR_5_TO_3: {
            actions: pour5to3
          },
          FILL_3: {
            actions: fill3
          },
          FILL_5: {
            actions: fill5
          },
          EMPTY_3: {
            actions: empty3
          },
          EMPTY_5: {
            actions: empty5
          }
        },
        meta: {
          description: (state) => {
            return `pending with (${state.context.three}, ${state.context.five})`;
          },
          test: async ({ jugs }, state) => {
            expect(jugs.five).not.toEqual(4);
            expect(jugs.three).toEqual(state.context.three);
            expect(jugs.five).toEqual(state.context.five);
          }
        }
      },
      success: {
        type: 'final',
        meta: {
          description: '4 gallons',
          test: async ({ jugs }) => {
            expect(jugs.five).toEqual(4);
          }
        }
      }
    }
  },
  {
    guards: {
      weHave4Gallons: (ctx) => ctx.five === 4
    }
  }
);

class Jugs {
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

const dieHardModel = createTestModel(dieHardMachine, {
  events: {
    POUR_3_TO_5: {
      exec: async (_step, { jugs }) => {
        await jugs.transferThree();
      }
    },
    POUR_5_TO_3: {
      exec: async (_step, { jugs }) => {
        await jugs.transferFive();
      }
    },
    EMPTY_3: {
      exec: async (_step, { jugs }) => {
        await jugs.emptyThree();
      }
    },
    EMPTY_5: {
      exec: async (_step, { jugs }) => {
        await jugs.emptyFive();
      }
    },
    FILL_3: {
      exec: async (_step, { jugs }) => {
        await jugs.fillThree();
      }
    },
    FILL_5: {
      exec: async (_step, { jugs }) => {
        await jugs.fillFive();
      }
    }
  }
});

describe('testing a model (shortestPathsTo)', () => {
  dieHardModel
    .getShortestPlansTo((state) => state.matches('success'))
    .forEach((plan) => {
      describe(`plan ${getDescription(plan.state)}`, () => {
        it('should generate a single path', () => {
          expect(plan.paths.length).toEqual(1);
        });

        plan.paths.forEach((path) => {
          it(`path ${getDescription(path.state)}`, () => {
            const testJugs = new Jugs();
            return dieHardModel.testPath(path, { jugs: testJugs });
          });
        });
      });
    });
});

describe('testing a model (simplePathsTo)', () => {
  dieHardModel
    .getSimplePlansTo((state) => state.matches('success'))
    .forEach((plan) => {
      describe(`reaches state ${JSON.stringify(
        plan.state.value
      )} (${JSON.stringify(plan.state.context)})`, () => {
        plan.paths.forEach((path) => {
          it(`path ${getDescription(path.state)}`, () => {
            const testJugs = new Jugs();
            return dieHardModel.testPath(path, { jugs: testJugs });
          });
        });
      });
    });
});

describe('testing a model (getPlanFromEvents)', () => {
  const plan = dieHardModel.getPlanFromEvents(
    [
      { type: 'FILL_5' },
      { type: 'POUR_5_TO_3' },
      { type: 'EMPTY_3' },
      { type: 'POUR_5_TO_3' },
      { type: 'FILL_5' },
      { type: 'POUR_5_TO_3' }
    ],
    (state) => state.matches('success')
  );

  describe(`reaches state ${JSON.stringify(plan.state.value)} (${JSON.stringify(
    plan.state.context
  )})`, () => {
    plan.paths.forEach((path) => {
      it(`path ${getDescription(path.state)}`, () => {
        const testJugs = new Jugs();
        return dieHardModel.testPath(path, { jugs: testJugs });
      });
    });
  });

  it('should throw if the target does not match the last entered state', () => {
    expect(() => {
      dieHardModel.getPlanFromEvents([{ type: 'FILL_5' }], (state) =>
        state.matches('success')
      );
    }).toThrow();
  });
});

describe('.testPath(path)', () => {
  const plans = dieHardModel.getSimplePlansTo((state) => {
    return state.matches('success') && state.context.three === 0;
  });

  plans.forEach((plan) => {
    describe(`reaches state ${JSON.stringify(
      plan.state.value
    )} (${JSON.stringify(plan.state.context)})`, () => {
      plan.paths.forEach((path) => {
        describe(`path ${getDescription(path.state)}`, () => {
          it(`reaches the target state`, () => {
            const testJugs = new Jugs();
            return dieHardModel.testPath(path, { jugs: testJugs });
          });
        });
      });
    });
  });
});

describe('error path trace', () => {
  describe('should return trace for failed state', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          on: { NEXT: 'second' }
        },
        second: {
          on: { NEXT: 'third' }
        },
        third: {
          meta: {
            test: () => {
              throw new Error('test error');
            }
          }
        }
      }
    });

    const testModel = createTestModel(machine);

    testModel
      .getShortestPlansTo((state) => state.matches('third'))
      .forEach((plan) => {
        plan.paths.forEach((path) => {
          it('should show an error path trace', async () => {
            try {
              await testModel.testPath(path, undefined);
            } catch (err) {
              expect(err.message).toEqual(
                expect.stringContaining('test error')
              );
              expect(err.message).toMatchInlineSnapshot(`
                "test error
                Path:
                	State: \\"first\\" |  | \\"\\"
                	Event: {\\"type\\":\\"NEXT\\"}

                	State: \\"second\\" |  | \\"\\"
                	Event: {\\"type\\":\\"NEXT\\"}

                	State: \\"third\\" |  | \\"\\""
              `);
              return;
            }

            throw new Error('Should have failed');
          });
        });
      });
  });
});

describe('coverage', () => {
  it('reports state node coverage', async () => {
    const plans = dieHardModel.getSimplePlansTo((state) => {
      return state.matches('success') && state.context.three === 0;
    });

    for (const plan of plans) {
      for (const path of plan.paths) {
        const jugs = new Jugs();
        await dieHardModel.testPath(path, { jugs });
      }
    }

    const coverage = dieHardModel.getCoverage(stateValueCoverage());

    expect(coverage.every((c) => c.status === 'covered')).toEqual(true);

    expect(coverage.map((c) => [c.criterion.description, c.status]))
      .toMatchInlineSnapshot(`
      Array [
        Array [
          "Visits \\"dieHard\\"",
          "covered",
        ],
        Array [
          "Visits \\"dieHard.pending\\"",
          "covered",
        ],
        Array [
          "Visits \\"dieHard.success\\"",
          "covered",
        ],
      ]
    `);

    expect(() => dieHardModel.testCoverage(stateValueCoverage())).not.toThrow();
  });

  it('tests missing state node coverage', async () => {
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
        .getCoverage(stateValueCoverage())
        .filter((c) => c.status !== 'covered')
        .map((c) => c.criterion.description)
    ).toMatchInlineSnapshot(`
      Array [
        "Visits \\"test.secondMissing\\"",
        "Visits \\"test.third.threeMissing\\"",
      ]
    `);

    expect(() => testModel.testCoverage(stateValueCoverage()))
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
      await model.testPlan(plan, null);
    }

    const coverage = model.getCoverage(stateValueCoverage());

    expect(coverage).toHaveLength(5);

    expect(coverage.filter((c) => c.status !== 'covered')).toHaveLength(0);

    expect(() => model.testCoverage(stateValueCoverage())).not.toThrow();
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
        stateValueCoverage({
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
      await model.testPlan(plan, null);
    }

    // TODO: determine how to handle missing coverage for transient states,
    // which arguably should not be counted towards coverage, as the app is never in
    // a transient state for any length of time
    model.testCoverage(stateValueCoverage());
  });
});

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
      await testModel.testPlan(plan, undefined);
    }

    expect(() => testModel.testCoverage(stateValueCoverage())).not.toThrow();
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
        await testModel.testPlan(plan, undefined);
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
    await model.testPlan(plan, undefined);
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
      await model.testPlan(plan, null as any);
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
      await model.testPlan(plan, null as any);
    }

    expect(testedEvents).toEqual(['NEXT', 'NEXT', 'PREV']);
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
      testState: (state, service) => {
        return new Promise((res) => {
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
      testTransition: (step, service) => {
        if (step.event.type.startsWith('done.')) {
          return;
        }

        service.send(step.event);
      },
      events: {
        START: {
          cases: () => [
            { type: 'START', value: 42 },
            { type: 'START', value: 1 }
          ]
        }
      }
    });

    // const plans = model.getShortestPlansTo((state) => state.matches('success'));
    const plans = model.getShortestPlans();

    for (const plan of plans) {
      for (const path of plan.paths) {
        const service = interpret(machine).start();

        service.subscribe((state) => {
          console.log(state.event, state.value);
        });

        await model.testPath(path, service);
      }
    }

    model.testCoverage(stateValueCoverage());
  });
});

// https://github.com/statelyai/xstate/issues/1538
it('tests transitions', async () => {
  expect.assertions(3);
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

  const model = createTestModel(machine, {
    events: {
      NEXT: {
        exec: (step, sut) => {
          expect(step).toHaveProperty('event');
          expect(step).toHaveProperty('state');
          expect(sut).toBe(obj);
        }
      }
    }
  });

  const plans = model.getShortestPlansTo((state) => state.matches('second'));

  const path = plans[0].paths[0];

  await model.testPath(path, obj);
});
