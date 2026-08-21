import { createMachine, setup, types } from '../../index.ts';
import { createTestModel } from '../index.ts';
import { testUtils } from './testUtils.ts';

describe('events', () => {
  it('should execute events (`exec` property)', async () => {
    let executed = false;

    const testModel = createTestModel(
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: { target: 'b' }
            }
          },
          b: {}
        }
      })
    );

    await testUtils.testModel(testModel, {
      events: {
        EVENT: () => {
          executed = true;
        }
      }
    });

    expect(executed).toBe(true);
  });

  it('should execute events (function)', async () => {
    let executed = false;

    const testModel = createTestModel(
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: { target: 'b' }
            }
          },
          b: {}
        }
      })
    );

    await testUtils.testModel(testModel, {
      events: {
        EVENT: () => {
          executed = true;
        }
      }
    });

    expect(executed).toBe(true);
  });

  it('should provide the full event (with payload) to the event executor', async () => {
    const values: number[] = [];

    const machine = setup({
      schemas: {
        events: {
          PAY: types<{ amount: number }>(),
          CANCEL: types<{}>()
        }
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            PAY: { target: 'b' },
            CANCEL: { target: 'b' }
          }
        },
        b: {}
      }
    });

    const testModel = createTestModel(machine, {
      events: [{ type: 'PAY', amount: 10 }, { type: 'CANCEL' }]
    });

    for (const path of testModel.getShortestPaths()) {
      await path.test({
        events: {
          PAY: ({ event }) => {
            // no `Extract<...>` cast needed: the payload survives
            event.amount satisfies number;
            values.push(event.amount);
          },
          CANCEL: ({ event }) => {
            event.type satisfies 'CANCEL';
            // @ts-expect-error `amount` only exists on `PAY`
            event.amount;
          }
        }
      });
    }

    expect(values).toEqual([10]);
  });
});
