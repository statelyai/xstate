import { createMachine, interpret } from '../src';

describe('error handling', () => {
  // https://github.com/statelyai/xstate/issues/4004
  it('does not cause an infinite loop when an error is thrown in subscribe', () => {
    const machine = createMachine({
      id: 'machine',
      initial: 'initial',
      context: {
        count: 0
      },
      states: {
        initial: {
          on: { activate: 'active' }
        },
        active: {}
      }
    });

    const spy = jest.fn().mockImplementation(() => {
      throw new Error('blah');
    });

    const actor = interpret(machine).start();

    actor.subscribe(spy);
    actor.send({ type: 'activate' });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
