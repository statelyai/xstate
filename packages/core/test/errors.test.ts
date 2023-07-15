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

    const actor = interpret(machine);
    let count = 0;
    actor.subscribe((state) => {
      console.log(state.value, state.context);
      if (count !== 0) {
        throw new Error('blah');
      }
      count++;
    });

    actor.start();

    expect(() => {
      actor.send({ type: 'activate' });
    }).toThrow();
  });
});
