import { createTestModel } from '../src/index.ts';
import { createTestMachine } from '../src/machine';
import { testUtils } from './testUtils';

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
});
