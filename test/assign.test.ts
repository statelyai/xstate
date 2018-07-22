import { assert } from 'chai';
import { Machine, actions } from '../src/index';

interface C {
  count: number;
}
const counterMachine = Machine<C>(
  {
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
  },
  undefined,
  { count: 0 }
);

describe('assign', () => {
  it('applies the assignment to the external state', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'INC'
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.ext, { count: 1 });

    const twoState = counterMachine.transition(oneState, 'INC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.ext, { count: 2 });
  });

  it('applies the assignment to the explicit external state', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'INC',
      { count: 50 }
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.ext, { count: 51 });

    const twoState = counterMachine.transition(oneState, 'INC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.ext, { count: 52 });

    const threeState = counterMachine.transition(twoState, 'INC', {
      count: 102
    });

    assert.deepEqual(threeState.value, 'counting');
    assert.deepEqual(threeState.ext, { count: 103 });
  });
});
