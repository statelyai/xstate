import { assert } from 'chai';
import { Machine } from 'xstate';
import { updater, assign } from '../src/index';

describe('Immer updater', () => {
  it('should update the context without modifying previous contexts', () => {
    const context = {
      count: 0
    };
    const countMachine = Machine<typeof context>(
      {
        id: 'count',
        context,
        initial: 'active',
        states: {
          active: {
            on: {
              INC: {
                actions: assign<typeof context>(ctx => ctx.count++)
              }
            }
          }
        }
      },
      {
        updater
      }
    );

    const zeroState = countMachine.initialState;
    const oneState = countMachine.transition(zeroState, 'INC');
    const twoState = countMachine.transition(zeroState, 'INC');

    assert.deepEqual(zeroState.context, { count: 0 });
    assert.deepEqual(oneState.context, { count: 1 });
    assert.deepEqual(twoState.context, { count: 1 });
  });

  it('should perform multiple updates correctly', () => {
    const context = {
      count: 0
    };
    const countMachine = Machine<typeof context>(
      {
        id: 'count',
        context,
        initial: 'active',
        states: {
          active: {
            on: {
              INC_TWICE: {
                actions: ['increment', 'increment']
              }
            }
          }
        }
      },
      {
        actions: {
          increment: assign<typeof context>(ctx => ctx.count++)
        },
        updater
      }
    );

    const zeroState = countMachine.initialState;
    const twoState = countMachine.transition(zeroState, 'INC_TWICE');

    assert.deepEqual(zeroState.context, { count: 0 });
    assert.deepEqual(twoState.context, { count: 2 });
  });

  it('should perform deep updates correctly', () => {
    const context = {
      foo: {
        bar: {
          baz: [1, 2, 3]
        }
      }
    };
    const countMachine = Machine<typeof context>(
      {
        id: 'count',
        context,
        initial: 'active',
        states: {
          active: {
            on: {
              INC_TWICE: {
                actions: ['pushBaz', 'pushBaz']
              }
            }
          }
        }
      },
      {
        actions: {
          pushBaz: assign<typeof context>(ctx => ctx.foo.bar.baz.push(0))
        },
        updater
      }
    );

    const zeroState = countMachine.initialState;
    const twoState = countMachine.transition(zeroState, 'INC_TWICE');

    assert.deepEqual(zeroState.context.foo.bar.baz, [1, 2, 3]);
    assert.deepEqual(twoState.context.foo.bar.baz, [1, 2, 3, 0, 0]);
  });
});
