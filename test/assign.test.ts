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
    const nextState = counterMachine.transition('counting', 'INC', {
      count: 0
    });

    assert.deepEqual(nextState.value, 'counting');
    assert.deepEqual(nextState.ext, { count: 1 });
  });
});
