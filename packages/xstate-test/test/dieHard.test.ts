import { assign, createMachine, setup } from 'xstate';
import { createTestModel } from '../src/index.ts';
import { getDescription } from '../src/utils';

describe('die hard example', () => {
  interface DieHardContext {
    three: number;
    five: number;
  }

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
  const dieHardMachine = setup({
    types: {
      context: {} as DieHardContext,
      events: {} as
        | {
            type: 'POUR_3_TO_5';
          }
        | {
            type: 'POUR_5_TO_3';
          }
        | {
            type: 'FILL_3';
          }
        | {
            type: 'FILL_5';
          }
        | {
            type: 'EMPTY_3';
          }
        | {
            type: 'EMPTY_5';
          }
    },
    guards: {
      weHave4Gallons: ({ context }) => context.five === 4
    }
  }).createMachine({
    id: 'dieHard',
    initial: 'pending',
    context: { three: 0, five: 0 },
    states: {
      pending: {
        always: {
          target: 'success',
          guard: 'weHave4Gallons'
        },
        on: {
          POUR_3_TO_5: {
            actions: assign(({ context }) => {
              const poured = Math.min(5 - context.five, context.three);

              return {
                three: context.three - poured,
                five: context.five + poured
              };
            })
          },
          POUR_5_TO_3: {
            actions: assign(({ context }) => {
              const poured = Math.min(3 - context.three, context.five);

              const res = {
                three: context.three + poured,
                five: context.five - poured
              };

              return res;
            })
          },
          FILL_3: {
            actions: assign({ three: 3 })
          },
          FILL_5: {
            actions: assign({ five: 5 })
          },
          EMPTY_3: {
            actions: assign({ three: 0 })
          },
          EMPTY_5: {
            actions: assign({ five: 0 })
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  const dieHardModel = createTestModel(dieHardMachine);

  describe('testing a model (shortestPathsTo)', () => {
    const paths = dieHardModel.getShortestPaths({
      toState: (state) => state.matches('success')
    });

    it('should generate the right number of paths', () => {
      expect(paths.length).toEqual(2);
    });

    paths.forEach((path) => {
      describe(`path ${getDescription(path.state)}`, () => {
        it(`path ${getDescription(path.state)}`, async () => {
          const jugs = new Jugs();
          await dieHardModel.testPath(path, {
            states: {
              pending: (
                state: ReturnType<(typeof dieHardMachine)['transition']>
              ) => {
                expect(jugs.five).not.toEqual(4);
                expect(jugs.three).toEqual(state.context.three);
                expect(jugs.five).toEqual(state.context.five);
              },
              success: () => {
                expect(jugs.five).toEqual(4);
              }
            },
            events: {
              POUR_3_TO_5: async () => {
                await jugs.transferThree();
              },
              POUR_5_TO_3: async () => {
                await jugs.transferFive();
              },
              EMPTY_3: async () => {
                await jugs.emptyThree();
              },
              EMPTY_5: async () => {
                await jugs.emptyFive();
              },
              FILL_3: async () => {
                await jugs.fillThree();
              },
              FILL_5: async () => {
                await jugs.fillFive();
              }
            }
          });
        });
      });
    });
  });

  describe('testing a model (simplePathsTo)', () => {
    const paths = dieHardModel.getSimplePaths({
      toState: (state) => state.matches('success')
    });

    it('should generate the right number of paths', () => {
      expect(paths.length).toEqual(14);
    });

    paths.forEach((path) => {
      describe(`reaches state ${JSON.stringify(
        path.state.value
      )} (${JSON.stringify(path.state.context)})`, () => {
        it(`path ${getDescription(path.state)}`, async () => {
          const jugs = new Jugs();
          await dieHardModel.testPath(path, {
            states: {
              pending: (
                state: ReturnType<(typeof dieHardMachine)['transition']>
              ) => {
                expect(jugs.five).not.toEqual(4);
                expect(jugs.three).toEqual(state.context.three);
                expect(jugs.five).toEqual(state.context.five);
              },
              success: () => {
                expect(jugs.five).toEqual(4);
              }
            },
            events: {
              POUR_3_TO_5: async () => {
                await jugs.transferThree();
              },
              POUR_5_TO_3: async () => {
                await jugs.transferFive();
              },
              EMPTY_3: async () => {
                await jugs.emptyThree();
              },
              EMPTY_5: async () => {
                await jugs.emptyFive();
              },
              FILL_3: async () => {
                await jugs.fillThree();
              },
              FILL_5: async () => {
                await jugs.fillFive();
              }
            }
          });
        });
      });
    });
  });

  describe('testing a model (getPathFromEvents)', () => {
    const path = dieHardModel.getPathsFromEvents(
      [
        { type: 'FILL_5' },
        { type: 'POUR_5_TO_3' },
        { type: 'EMPTY_3' },
        { type: 'POUR_5_TO_3' },
        { type: 'FILL_5' },
        { type: 'POUR_5_TO_3' }
      ],
      { toState: (state) => state.matches('success') }
    )[0];

    describe(`reaches state ${JSON.stringify(
      path.state.value
    )} (${JSON.stringify(path.state.context)})`, () => {
      it(`path ${getDescription(path.state)}`, async () => {
        const jugs = new Jugs();
        await dieHardModel.testPath(path, {
          states: {
            pending: (
              state: ReturnType<(typeof dieHardMachine)['transition']>
            ) => {
              expect(jugs.five).not.toEqual(4);
              expect(jugs.three).toEqual(state.context.three);
              expect(jugs.five).toEqual(state.context.five);
            },
            success: () => {
              expect(jugs.five).toEqual(4);
            }
          },
          events: {
            POUR_3_TO_5: async () => {
              await jugs.transferThree();
            },
            POUR_5_TO_3: async () => {
              await jugs.transferFive();
            },
            EMPTY_3: async () => {
              await jugs.emptyThree();
            },
            EMPTY_5: async () => {
              await jugs.emptyFive();
            },
            FILL_3: async () => {
              await jugs.fillThree();
            },
            FILL_5: async () => {
              await jugs.fillFive();
            }
          }
        });
      });
    });

    it('should return no paths if the target does not match the last entered state', () => {
      const paths = dieHardModel.getPathsFromEvents([{ type: 'FILL_5' }], {
        toState: (state) => state.matches('success')
      });

      expect(paths).toHaveLength(0);
    });
  });

  describe('.testPath(path)', () => {
    const paths = dieHardModel.getSimplePaths({
      toState: (state) => {
        return state.matches('success') && state.context.three === 0;
      }
    });

    it('should generate the right number of paths', () => {
      expect(paths.length).toEqual(6);
    });

    paths.forEach((path) => {
      describe(`reaches state ${JSON.stringify(
        path.state.value
      )} (${JSON.stringify(path.state.context)})`, () => {
        describe(`path ${getDescription(path.state)}`, () => {
          it(`reaches the target state`, async () => {
            const jugs = new Jugs();
            await dieHardModel.testPath(path, {
              states: {
                pending: (
                  state: ReturnType<(typeof dieHardMachine)['transition']>
                ) => {
                  expect(jugs.five).not.toEqual(4);
                  expect(jugs.three).toEqual(state.context.three);
                  expect(jugs.five).toEqual(state.context.five);
                },
                success: () => {
                  expect(jugs.five).toEqual(4);
                }
              },
              events: {
                POUR_3_TO_5: async () => {
                  await jugs.transferThree();
                },
                POUR_5_TO_3: async () => {
                  await jugs.transferFive();
                },
                EMPTY_3: async () => {
                  await jugs.emptyThree();
                },
                EMPTY_5: async () => {
                  await jugs.emptyFive();
                },
                FILL_3: async () => {
                  await jugs.fillThree();
                },
                FILL_5: async () => {
                  await jugs.fillFive();
                }
              }
            });
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
          on: { NEXT_1: 'second' }
        },
        second: {
          on: { NEXT_2: 'third' }
        },
        third: {}
      }
    });

    const testModel = createTestModel(machine);

    it('should generate the right number of paths', () => {
      expect(
        testModel.getShortestPaths({
          toState: (state) => state.matches('third')
        }).length
      ).toEqual(1);
    });

    it('should show an error path trace', async () => {
      const path = testModel.getShortestPaths({
        toState: (state) => state.matches('third')
      })[0];
      try {
        await testModel.testPath(path, {
          states: {
            third: () => {
              throw new Error('test error');
            }
          }
        });
      } catch (err: any) {
        expect(err.message).toEqual(expect.stringContaining('test error'));
        expect(err.message).toMatchInlineSnapshot(`
          "test error
          Path:
          	State: {"value":"first"}
          	Event: {"type":"xstate.init"}

          	State: {"value":"second"} via {"type":"xstate.init"}
          	Event: {"type":"NEXT_1"}

          	State: {"value":"third"} via {"type":"NEXT_1"}
          	Event: {"type":"NEXT_2"}

          	State: {"value":"third"} via {"type":"NEXT_2"}"
        `);
        return;
      }

      throw new Error('Should have failed');
    });
  });
});
