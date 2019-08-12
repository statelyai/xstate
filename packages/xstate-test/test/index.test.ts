// nothing yet
import { createModel } from '../src';
import { Machine, assign } from 'xstate';

const dieHardMachine = Machine<{ 3: number; 5: number }>(
  {
    initial: 'pending',
    context: { 3: 0, 5: 0 },
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
        }
      },
      success: {}
    }
  },
  {
    actions: {
      pour3to5: assign(ctx => {
        const poured = Math.min(5 - ctx[5], ctx[3]);

        return {
          3: ctx[3] - poured,
          5: ctx[5] + poured
        };
      }),
      pour5to3: assign(ctx => {
        const poured = Math.min(3 - ctx[3], ctx[5]);

        return {
          3: ctx[3] + poured,
          5: ctx[5] - poured
        };
      }),
      fill3: assign({ 3: 3 }),
      fill5: assign({ 5: 5 }),
      empty3: assign({ 3: 0 }),
      empty5: assign({ 5: 0 })
    },
    guards: {
      weHave4Gallons: ctx => ctx[5] === 4
    }
  }
);

describe('blah', () => {
  it('loads the page', async () => {
    await page.goto('http://localhost:3000');
  });

  const testModel = createModel(dieHardMachine, {
    events: {
      POUR_3_TO_5: {
        exec: async () => {
          await page.click('[data-testid="transfer-3-button"]');
        }
      },
      POUR_5_TO_3: {
        exec: async () => {
          await page.click('[data-testid="transfer-5-button"]');
        }
      },
      EMPTY_3: {
        exec: async () => {
          await page.click('[data-testid="empty-3-button"]');
        }
      },
      EMPTY_5: {
        exec: async () => {
          await page.click('[data-testid="empty-5-button"]');
        }
      },
      FILL_3: {
        exec: async () => {
          await page.click('[data-testid="fill-3-button"]');
        }
      },
      FILL_5: {
        exec: async () => {
          await page.click('[data-testid="fill-5-button"]');
        }
      }
    }
  });

  testModel
    .shortestPaths()
    .filter(plan => {
      return plan.state.matches('success');
    })
    .forEach(plan => {
      describe(`reaches state ${JSON.stringify(
        plan.state.value
      )}`, async () => {
        plan.paths[0].path.forEach(segment => {
          it(`goes to ${JSON.stringify(segment.state.value)}`, async () => {
            await segment.test();
          });

          it(`executes ${JSON.stringify(segment.event)}`, async () => {
            await segment.exec();
          });
        });
      });
    });

  console.log(testModel);
});
