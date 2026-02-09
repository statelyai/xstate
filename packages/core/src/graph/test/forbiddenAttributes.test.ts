import { fromPromise, createMachine } from '../../index.ts';
import { createTestModel } from '../index.ts';

describe.skip('Forbidden attributes', () => {
  it('Should not let you declare invocations on your test machine', () => {
    const machine = createMachine({
      invoke: {
        src: fromPromise(async () => {})
      }
    });

    expect(() => {
      createTestModel(machine);
    }).toThrow('Invocations on test machines are not supported');
  });

  it('Should not let you declare after on your test machine', () => {
    const machine = createMachine({
      after: {
        5000: (_, enq) => {
          enq(() => {});
        }
      }
    });

    expect(() => {
      createTestModel(machine);
    }).toThrow('After events on test machines are not supported');
  });

  it('Should not let you delayed actions on your machine', () => {
    const machine = createMachine({
      // entry: [
      //   raise(
      //     {
      //       type: 'EVENT'
      //     },
      //     {
      //       delay: 1000
      //     }
      //   )
      // ]
      entry: (_, enq) => {
        enq.raise(
          {
            type: 'EVENT'
          },
          {
            delay: 1000
          }
        );
      }
    });

    expect(() => {
      createTestModel(machine);
    }).toThrow('Delayed actions on test machines are not supported');
  });
});
