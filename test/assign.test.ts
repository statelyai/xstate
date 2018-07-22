import { assert } from 'chai';
import { Machine, actions } from '../src/index';

interface C {
  count: number;
}
const counterMachine = Machine<C>({
  initial: 'counting',
  states: {
    counting: {
      on: {
        INC: [
          {
            target: 'counting',
            actions: [
              actions.assign<C>(xs => ({
                count: xs.count + 1
              }))
            ]
          }
        ]
      }
    }
  }
});

describe('assign', () => {
  it('applies the assignment to the external state', () => {
    const oneState = counterMachine.transition('counting', 'INC', {
      count: 0
    });

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.ext, { count: 1 });

    const twoState = counterMachine.transition(oneState, 'INC', oneState.ext);

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.ext, { count: 2 });
  });
});
