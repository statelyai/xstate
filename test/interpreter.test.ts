import { interpret, Interpreter } from '../src/interpreter';
import { assert } from 'chai';
import { machine as idMachine } from './fixtures/id';
import { State } from '../src';

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
});
