import { createTestModel } from '../src';
import { createTestMachine } from '../src/machine';
import { testUtils } from '../src/testUtils';

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

    await testUtils.testModel(testModel);

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

    await testUtils.testModel(testModel);

    expect(executed).toBe(true);
  });
});
