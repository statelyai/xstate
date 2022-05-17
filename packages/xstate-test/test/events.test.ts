import { createTestModel } from '../src';
import { createTestMachine } from '../src/machine';

describe('events', () => {
  it('should execute events (`exec` property)', async () => {
    let executed = false;

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

    await testModel.testPlans(testModel.getShortestPlans());

    expect(executed).toBe(true);
  });

  it('should execute events (function)', async () => {
    let executed = false;

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
      }),
      {
        events: {
          EVENT: () => {
            executed = true;
          }
        }
      }
    );

    await testModel.testPlans(testModel.getShortestPlans());

    expect(executed).toBe(true);
  });
});
