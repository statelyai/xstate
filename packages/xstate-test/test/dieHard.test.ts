import { assign, createMachine } from 'xstate';
import { createTestModel } from '../src';
import { createTestMachine } from '../src/machine';
import { getDescription } from '../src/utils';

describe('die hard example', () => {
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

  const createDieHardModel = () => {
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
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        guards: {
          weHave4Gallons: (ctx) => ctx.five === 4
        }
      }
    );

    const options = {
      states: {
        pending: (state) => {
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
    };

    return {
      model: createTestModel(dieHardMachine),
      options
    };
  };

  beforeEach(() => {
    jugs = new Jugs();
    jugs.version = Math.random();
  });

  describe('testing a model (shortestPathsTo)', () => {
    const dieHardModel = createDieHardModel();

    const paths = dieHardModel.model.getShortestPaths({
      toState: (state) => state.matches('success')
    });

    it('should generate the right number of paths', () => {
      expect(paths.length).toEqual(2);
    });

    paths.forEach((path) => {
      describe(`path ${getDescription(path.state)}`, () => {
        it(`path ${getDescription(path.state)}`, async () => {
          await dieHardModel.model.testPath(path, dieHardModel.options);
        });
      });
    });
  });

  describe('testing a model (simplePathsTo)', () => {
    const dieHardModel = createDieHardModel();
    const paths = dieHardModel.model.getSimplePaths({
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
          await dieHardModel.model.testPath(path, dieHardModel.options);
        });
      });
    });
  });

  describe('testing a model (getPathFromEvents)', () => {
    const dieHardModel = createDieHardModel();

    const path = dieHardModel.model.getPathsFromEvents(
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
        await dieHardModel.model.testPath(path, dieHardModel.options);
      });
    });

    it('should return no paths if the target does not match the last entered state', () => {
      const paths = dieHardModel.model.getPathsFromEvents(
        [{ type: 'FILL_5' }],
        {
          toState: (state) => state.matches('success')
        }
      );

      expect(paths).toHaveLength(0);
    });
  });

  describe('.testPath(path)', () => {
    const dieHardModel = createDieHardModel();
    const paths = dieHardModel.model.getSimplePaths({
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
            await dieHardModel.model.testPath(path, dieHardModel.options);
          });
        });
      });
    });
  });
});
describe('error path trace', () => {
  describe('should return trace for failed state', () => {
    const machine = createTestMachine({
      initial: 'first',
      states: {
        first: {
          on: { NEXT: 'second' }
        },
        second: {
          on: { NEXT: 'third' }
        },
        third: {}
      }
    });

    const testModel = createTestModel(machine);

    const paths = testModel.getShortestPaths({
      toState: (state) => state.matches('third')
    });

    it('should generate the right number of paths', () => {
      expect(paths.length).toEqual(1);
    });

    paths.forEach((path) => {
      it('should show an error path trace', async () => {
        try {
          await testModel.testPath(path, {
            states: {
              third: () => {
                throw new Error('test error');
              }
            }
          });
        } catch (err) {
          expect(err.message).toEqual(expect.stringContaining('test error'));
          expect(err.message).toMatchInlineSnapshot(`
              "test error
              Path:
              	State: {\\"value\\":\\"first\\"}
              	Event: {\\"type\\":\\"NEXT\\"}

              	State: {\\"value\\":\\"second\\"} via {\\"type\\":\\"NEXT\\"}
              	Event: {\\"type\\":\\"NEXT\\"}

              	State: {\\"value\\":\\"third\\"} via {\\"type\\":\\"NEXT\\"}"
            `);
          return;
        }

        throw new Error('Should have failed');
      });
    });
  });
});
