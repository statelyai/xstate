import { createMachine } from 'xstate';
import { createTestModel } from '../src';

describe('events', () => {
  it('should execute events (`exec` property)', async () => {
    let executed = false;

    const testModel = createTestModel(
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: 'b'
            }
          },
          b: {}
        }
      }),
      {
        events: {
          EVENT: {
            exec: () => {
              executed = true;
            }
          }
        }
      }
    );

    await testModel.testPlans();

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
              EVENT: 'b'
            }
          },
          b: {}
        }
      }),
      {
        events: {
          EVENT: () => {
            executed = true;
          }
        }
      }
    );

    await testModel.testPlans();

    expect(executed).toBe(true);
  });
});
