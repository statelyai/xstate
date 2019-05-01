import { FSM, assign } from '../src';
import { assert } from 'chai';

describe('@xstate/fsm', () => {
  const lightFSM = FSM({
    initial: 'green',
    context: { count: 0, foo: 'bar' },
    states: {
      green: {
        entry: 'enterGreen',
        exit: [
          'exitGreen',
          assign({ count: ctx => ctx.count + 1 }),
          assign({ count: ctx => ctx.count + 1 }),
          assign({ foo: 'static' }),
          assign({ foo: ctx => ctx.foo + 'static' })
        ],
        on: {
          TIMER: {
            target: 'yellow',
            actions: ['g-y 1', 'g-y 2']
          }
        }
      },
      yellow: {}
    }
  });
  it('should have the correct initial state', () => {
    const { initialState } = lightFSM;

    assert.deepEqual(initialState.value, 'green');
    assert.deepEqual(initialState.actions, ['enterGreen']);
  });
  it('should transition correctly', () => {
    const nextState = lightFSM.transition('green', 'TIMER');
    assert.deepEqual(nextState.value, 'yellow');
    assert.deepEqual(nextState.actions.map(action => action.type), [
      'exitGreen',
      'g-y 1',
      'g-y 2'
    ]);
    assert.deepEqual(nextState.context, {});
  });

  it('should stay on the same state for undefined transitions', () => {
    const nextState = lightFSM.transition('green', 'FAKE');
    assert.deepEqual(nextState.value, 'green');
    assert.deepEqual(nextState.actions, []);
  });
});
