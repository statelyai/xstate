import { next_createMachine } from '../../index.ts';
import { createTestModel } from '../index.ts';
import { testUtils } from './testUtils.ts';

describe('events', () => {
  it('should execute events (`exec` property)', async () => {
    let executed = false;

    const testModel = createTestModel(
      next_createMachine({
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
      next_createMachine({
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
