import { interpret, Interpreter } from '../src/interpreter';
import { assert } from 'chai';
import { machine as idMachine } from './fixtures/id';
import { Machine, actions } from '../src';
import { State } from '../src/State';

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
      after: {
        10: 'green'
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
    let result: State<any> | undefined;

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
      const currentStates: Array<State<any>> = [];
      const listener = state => {
        currentStates.push(state);

        if (currentStates.length === 4) {
          assert.deepEqual(currentStates.map(s => s.value), [
            'green',
            'yellow',
            'red',
            'green'
          ]);
          done();
        }
      };

      const interpreter = interpret(lightMachine, listener);
      interpreter.init();

      setTimeout(() => {
        assert.equal(
          currentStates[0]!.value,
          'green',
          'State should still be green before delayed send'
        );
      }, 5);
    });
  });

  it('can cancel a delayed event', done => {
    let currentState: State<any>;
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
