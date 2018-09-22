import { interpret, Interpreter, SimulatedClock } from '../src/interpreter';
import { assert } from 'chai';
import { machine as idMachine } from './fixtures/id';
import { Machine, actions } from '../src';
import { State } from '../src/State';
import { log, assign } from '../src/actions';

const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      onEntry: [actions.send('TIMER', { delay: 10 })],
      on: {
        TIMER: 'yellow',
        KEEP_GOING: {
          target: 'green',
          actions: [actions.cancel('TIMER')],
          internal: true
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
    it('can send an event after a delay', () => {
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
        }
      };

      const interpreter = interpret(lightMachine, listener, {
        clock: new SimulatedClock()
      });
      const clock = interpreter.clock as SimulatedClock;
      interpreter.init();

      clock.increment(5);
      assert.equal(
        currentStates[0]!.value,
        'green',
        'State should still be green before delayed send'
      );

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), ['green', 'yellow']);

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), ['green', 'yellow']);

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), [
        'green',
        'yellow',
        'red'
      ]);

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), [
        'green',
        'yellow',
        'red'
      ]);

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), [
        'green',
        'yellow',
        'red',
        'green'
      ]);
    });
  });

  it('can cancel a delayed event', () => {
    let currentState: State<any>;
    const listener = state => (currentState = state);

    const interpreter = interpret(lightMachine, listener, {
      clock: new SimulatedClock()
    });
    const clock = interpreter.clock as SimulatedClock;
    interpreter.init();

    clock.increment(5);
    interpreter.send('KEEP_GOING');

    assert.deepEqual(currentState!.value, 'green');
    clock.increment(10);
    assert.deepEqual(
      currentState!.value,
      'green',
      'should still be green due to canceled event'
    );
  });

  it('should throw an error if an event is sent to an uninitialized interpreter', () => {
    const interpreter = interpret(lightMachine, noop);

    assert.throws(() => interpreter.send('SOME_EVENT'));

    interpreter.init();

    assert.doesNotThrow(() => interpreter.send('SOME_EVENT'));
  });

  it('should not update when stopped', () => {
    let state = lightMachine.initialState;
    const interpreter = interpret(lightMachine).onTransition(s => (state = s));

    interpreter.init();
    interpreter.send('TIMER'); // yellow
    assert.deepEqual(state.value, 'yellow');

    interpreter.stop();
    interpreter.send('TIMER'); // red if interpreter is not stopped
    assert.deepEqual(state.value, 'yellow');
  });

  it('should be able to log', () => {
    const logs: any[] = [];

    const logMachine = Machine({
      id: 'log',
      initial: 'x',
      context: { count: 0 },
      states: {
        x: {
          on: {
            LOG: {
              actions: [
                assign({ count: ctx => ctx.count + 1 }),
                log(ctx => ctx)
              ]
            }
          }
        }
      }
    });

    const interpreter = interpret(logMachine, noop, {
      logger: msg => logs.push(msg)
    }).start();

    interpreter.send('LOG');
    interpreter.send('LOG');

    assert.lengthOf(logs, 2);
    assert.deepEqual(logs, [{ count: 1 }, { count: 2 }]);
  });
});
