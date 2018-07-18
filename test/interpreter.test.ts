import { interpret, Interpreter } from '../src/interpreter';
import { assert } from 'chai';
import { machine as idMachine } from './fixtures/id';
import { State, Machine, actions } from '../src';

const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      onEntry: [actions.send('TIMER', { delay: 10 })],
      on: {
        TIMER: 'yellow',
        KEEP_GOING: {
          green: { actions: [actions.cancel('TIMER')], internal: true }
        }
      }
    },
    yellow: {
      onEntry: [actions.send('TIMER', { delay: 10 })],
      on: {
        TIMER: 'red'
      }
    },
    red: {
      onEntry: [actions.send('TIMER', { delay: 10 })],
      on: {
        TIMER: 'green'
      }
    }
  }
});

// tslint:disable-next-line:no-empty
const noop = () => {};

describe('interpreter', () => {
  it('creates an interpreter', () => {
    const interpreter = interpret(idMachine, noop);

    assert.instanceOf(interpreter, Interpreter);
  });

  it('immediately notifies the listener with the initial state', () => {
    let result: State | undefined;

    const interpreter = interpret(
      idMachine,
      initialState => (result = initialState)
    );

    interpreter.init();

    assert.instanceOf(result, State);
    assert.deepEqual(result!.value, idMachine.initialState.value);
  });

  describe('send with delay', () => {
    it('can send an event after a delay', done => {
      let currentState: State;
      const listener = state => {
        currentState = state;
      };

      const interpreter = interpret(lightMachine, listener);
      interpreter.init();

      setTimeout(() => {
        assert.deepEqual(currentState.value, 'yellow');
      }, 15);

      setTimeout(() => {
        assert.deepEqual(currentState.value, 'red');
      }, 25);

      setTimeout(() => {
        assert.deepEqual(currentState.value, 'green');
        done();
      }, 35);
    });
  });

  it('can cancel a delayed event', done => {
    let currentState: State;
    const listener = state => (currentState = state);

    const interpreter = interpret(lightMachine, listener);
    interpreter.init();

    setTimeout(() => {
      interpreter.send('KEEP_GOING');
    }, 1);

    setTimeout(() => {
      assert.deepEqual(currentState.value, 'green');
      done();
    }, 15);
  });
});
