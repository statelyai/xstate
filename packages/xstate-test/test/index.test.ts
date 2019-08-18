// nothing yet
import { createModel } from '../src';
import { Machine, assign } from 'xstate';

const dieHardMachine = Machine<{ three: number; five: number }>(
  {
    id: 'dieHard',
    initial: 'pending',
    context: { three: 0, five: 0 },
    states: {
      pending: {
        on: {
          '': {
            target: 'success',
            cond: 'weHave4Gallons'
          },
          POUR_3_TO_5: {
            actions: 'pour3to5'
          },
          POUR_5_TO_3: {
            actions: 'pour5to3'
          },
          FILL_3: {
            actions: 'fill3'
          },
          FILL_5: {
            actions: 'fill5'
          },
          EMPTY_3: {
            actions: 'empty3'
          },
          EMPTY_5: {
            actions: 'empty5'
          }
        },
        meta: {
          test: async ({ jugs }) => {
            expect(jugs.five).not.toEqual(4);
          }
        }
      },
      success: {
        type: 'final',
        meta: {
          test: async ({ jugs }) => {
            expect(jugs.five).toEqual(4);
          }
        }
      }
    }
  },
  {
    actions: {
      pour3to5: assign(ctx => {
        const poured = Math.min(5 - ctx.five, ctx.three);

        return {
          three: ctx.three - poured,
          five: ctx.five + poured
        };
      }),
      pour5to3: assign(ctx => {
        const poured = Math.min(3 - ctx.three, ctx.five);

        const res = {
          three: ctx.three + poured,
          five: ctx.five - poured
        };

        return res;
      }),
      fill3: assign({ three: 3 }),
      fill5: assign({ five: 5 }),
      empty3: assign({ three: 0 }),
      empty5: assign({ five: 0 })
    },
    guards: {
      weHave4Gallons: ctx => ctx.five === 4
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

const dieHardModel = createModel<{ jugs: Jugs }>(dieHardMachine, {
  events: {
    POUR_3_TO_5: {
      exec: async ({ jugs }) => {
        await jugs.transferThree();
      }
    },
    POUR_5_TO_3: {
      exec: async ({ jugs }) => {
        await jugs.transferFive();
      }
    },
    EMPTY_3: {
      exec: async ({ jugs }) => {
        await jugs.emptyThree();
      }
    },
    EMPTY_5: {
      exec: async ({ jugs }) => {
        await jugs.emptyFive();
      }
    },
    FILL_3: {
      exec: async ({ jugs }) => {
        await jugs.fillThree();
      }
    },
    FILL_5: {
      exec: async ({ jugs }) => {
        await jugs.fillFive();
      }
    }
  }
});

describe('testing a model (shortestPathsTo)', () => {
  dieHardModel
    .getShortestPathsTo('success') // ...
    .forEach((plan, planIndex) => {
      describe(`reaches state ${JSON.stringify(
        plan.state.value
      )} (${planIndex})`, () => {
        const testJugs = new Jugs();

        plan.paths.forEach((path, pathIndex) => {
          describe(`path ${pathIndex}`, () => {
            path.segments.forEach(segment => {
              it(`goes to ${JSON.stringify(
                segment.state.value
              )} ${JSON.stringify(segment.state.context)}`, async () => {
                await segment.test({ jugs: testJugs });
              });

              it(`executes ${JSON.stringify(segment.event)}`, async () => {
                await segment.exec({ jugs: testJugs });
              });
            });

            it('finalizes', async () => {
              await plan.test({ jugs: testJugs });
            });
          });
        });
      });
    });
});

describe('testing a model (simplePathsTo)', () => {
  dieHardModel
    .getSimplePathsTo('success') // ...
    .forEach(plan => {
      describe(`reaches state ${JSON.stringify(
        plan.state.value
      )} (${JSON.stringify(plan.state.context)})`, () => {
        plan.paths.forEach((path, pathIndex) => {
          describe(`path ${pathIndex}`, () => {
            const testJugs = new Jugs();

            path.segments.forEach(segment => {
              it(`goes to ${JSON.stringify(
                segment.state.value
              )} ${JSON.stringify(segment.state.context)}`, async () => {
                await segment.test({ jugs: testJugs });
              });

              it(`executes ${JSON.stringify(segment.event)}`, async () => {
                await segment.exec({ jugs: testJugs });
              });
            });

            it('finalizes', async () => {
              await plan.test({ jugs: testJugs });
            });
          });
        });
      });
    });
});

describe('testing a model (simplePathsTo + predicate)', () => {
  const plans = dieHardModel.getSimplePathsTo(state => {
    return state.matches('success') && state.context.three === 0;
  });

  // ...
  plans.forEach(plan => {
    describe(`reaches state ${JSON.stringify(
      plan.state.value
    )} (${JSON.stringify(plan.state.context)})`, () => {
      plan.paths.forEach((path, pathIndex) => {
        describe(`path ${pathIndex}`, () => {
          const testJugs = new Jugs();

          path.segments.forEach(segment => {
            it(`goes to ${JSON.stringify(segment.state.value)} ${JSON.stringify(
              segment.state.context
            )}`, async () => {
              await segment.test({ jugs: testJugs });
            });

            it(`executes ${JSON.stringify(segment.event)}`, async () => {
              await segment.exec({ jugs: testJugs });
            });
          });

          it('finalizes', async () => {
            await plan.test({ jugs: testJugs });
          });
        });
      });
    });
  });
});

describe('coverage', () => {
  it('reports state node coverage', () => {
    const coverage = dieHardModel.getCoverage();

    expect(coverage.stateNodes['dieHard.pending']).toBeGreaterThan(0);
    expect(coverage.stateNodes['dieHard.success']).toBeGreaterThan(0);
  });
});
