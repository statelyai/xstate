import { createMachine, raise } from 'xstate';
import { createTestModel } from '../src/index.ts';

describe('Forbidden attributes', () => {
  it('Should not let you declare invocations on your test machine', () => {
    const machine = createMachine({
      invoke: {
        src: 'myInvoke'
      }
    });

    expect(() => {
      createTestModel(machine);
    }).toThrowError('Invocations on test machines are not supported');
  });

  it('Should not let you declare after on your test machine', () => {
    const machine = createMachine({
      after: {
        5000: {
          actions: () => {}
        }
      }
    });

    expect(() => {
      createTestModel(machine);
    }).toThrowError('After events on test machines are not supported');
  });

  it('Should not let you delayed actions on your machine', () => {
    const machine = createMachine({
      entry: [
        raise(
          {
            type: 'EVENT'
          },
          {
            delay: 1000
          }
        )
      ]
    });

    expect(() => {
      createTestModel(machine);
    }).toThrowError('Delayed actions on test machines are not supported');
  });
});
