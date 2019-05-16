import { FSM, assign } from '../src';
import { assert } from 'chai';

describe('@xstate/fsm', () => {
  const lightFSM = FSM({
    id: 'light',
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
          assign({ foo: ctx => ctx.foo + '++' })
        ],
        on: {
          TIMER: {
            target: 'yellow',
            actions: ['g-y 1', 'g-y 2']
          }
        }
      },
      yellow: {
        on: {
          INC: { actions: assign({ count: ctx => ctx.count + 1 }) },
          EMERGENCY: {
            target: 'red',
            cond: (ctx, e) => ctx.count + e.value === 2
          }
        }
      },
      red: {}
    }
  });
  it('should have the correct initial state', () => {
    const { initialState } = lightFSM;

    assert.deepEqual(initialState.value, 'green');
    assert.deepEqual(initialState.actions, [{ type: 'enterGreen' }]);
  });
  it('should transition correctly', () => {
    const nextState = lightFSM.transition('green', 'TIMER');
    assert.deepEqual(nextState.value, 'yellow');
    assert.deepEqual(nextState.actions.map(action => action.type), [
      'exitGreen',
      'g-y 1',
      'g-y 2'
    ]);
    assert.deepEqual(nextState.context, {
      count: 2,
      foo: 'static++'
    });
  });

  it('should stay on the same state for undefined transitions', () => {
    const nextState = lightFSM.transition('green', 'FAKE');
    assert.deepEqual(nextState.value, 'green');
    assert.deepEqual(nextState.actions, []);
  });

  it('should throw an error for undefined states', () => {
    assert.throws(() => {
      lightFSM.transition('unknown', 'TIMER');
    });
  });

  it('should work with guards', () => {
    const yellowState = lightFSM.transition('yellow', 'EMERGENCY');
    assert.deepEqual(yellowState.value, 'yellow');

    const redState = lightFSM.transition('yellow', {
      type: 'EMERGENCY',
      value: 2
    });
    assert.deepEqual(redState.value, 'red');
    assert.deepEqual(redState.context.count, 0);

    const yellowOneState = lightFSM.transition('yellow', 'INC');
    const redOneState = lightFSM.transition(yellowOneState, {
      type: 'EMERGENCY',
      value: 1
    });

    assert.deepEqual(redOneState.value, 'red');
    assert.deepEqual(redOneState.context.count, 1);
  });

  it('should be changed if state changes', () => {
    assert.isTrue(lightFSM.transition('green', 'TIMER').changed);
  });

  it('should be changed if any actions occur', () => {
    assert.isTrue(lightFSM.transition('yellow', 'INC').changed);
  });

  it('should not be changed on unkonwn transitions', () => {
    assert.isFalse(lightFSM.transition('yellow', 'UNKNOWN').changed);
  });
});
