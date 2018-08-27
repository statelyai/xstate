import { assert } from 'chai';
import { Machine, actions } from '../src/index';

interface C {
  count: number;
  foo: string;
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
          ],
          DEC: [
            {
              target: 'counting',
              actions: [
                actions.assign<C>({
                  count: xs => xs.count - 1
                })
              ]
            }
          ],
          WIN_PROP: [
            {
              target: 'counting',
              actions: [
                actions.assign<C>({
                  count: () => 100,
                  foo: () => 'win'
                })
              ]
            }
          ],
          WIN_STATIC: [
            {
              target: 'counting',
              actions: [
                actions.assign<C>({
                  count: 100,
                  foo: 'win'
                })
              ]
            }
          ],
          WIN_MIX: [
            {
              target: 'counting',
              actions: [
                actions.assign<C>({
                  count: () => 100,
                  foo: 'win'
                })
              ]
            }
          ],
          WIN: [
            {
              target: 'counting',
              actions: [
                actions.assign<C>(() => ({
                  count: 100,
                  foo: 'win'
                }))
              ]
            }
          ]
        }
      }
    }
  },
  undefined,
  { count: 0, foo: 'bar' }
);

describe('assign', () => {
  it('applies the assignment to the external state (property assignment)', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'DEC'
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.ext, { count: -1, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, 'DEC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.ext, { count: -2, foo: 'bar' });
  });

  it('applies the assignment to the external state', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'INC'
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.ext, { count: 1, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, 'INC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.ext, { count: 2, foo: 'bar' });
  });

  it('applies the assignment to multiple properties (property assignment)', () => {
    const nextState = counterMachine.transition(
      counterMachine.initialState,
      'WIN_PROP'
    );

    assert.deepEqual(nextState.ext, { count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static)', () => {
    const nextState = counterMachine.transition(
      counterMachine.initialState,
      'WIN_STATIC'
    );

    assert.deepEqual(nextState.ext, { count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static + prop assignment)', () => {
    const nextState = counterMachine.transition(
      counterMachine.initialState,
      'WIN_MIX'
    );

    assert.deepEqual(nextState.ext, { count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties', () => {
    const nextState = counterMachine.transition(
      counterMachine.initialState,
      'WIN'
    );

    assert.deepEqual(nextState.ext, { count: 100, foo: 'win' });
  });

  it('applies the assignment to the explicit external state (property assignment)', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'DEC',
      { count: 50, foo: 'bar' }
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.ext, { count: 49, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, 'DEC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.ext, { count: 48, foo: 'bar' });

    const threeState = counterMachine.transition(twoState, 'DEC', {
      count: 100,
      foo: 'bar'
    });

    assert.deepEqual(threeState.value, 'counting');
    assert.deepEqual(threeState.ext, { count: 99, foo: 'bar' });
  });

  it('applies the assignment to the explicit external state', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'INC',
      { count: 50, foo: 'bar' }
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.ext, { count: 51, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, 'INC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.ext, { count: 52, foo: 'bar' });

    const threeState = counterMachine.transition(twoState, 'INC', {
      count: 102,
      foo: 'bar'
    });

    assert.deepEqual(threeState.value, 'counting');
    assert.deepEqual(threeState.ext, { count: 103, foo: 'bar' });
  });

  it('should maintain state after unhandled event', () => {
    const { initialState } = counterMachine;

    const nextState = counterMachine.transition(initialState, 'FAKE_EVENT');

    assert.isDefined(nextState.ext);
    assert.deepEqual(nextState.ext, { count: 0, foo: 'bar' });
  });
});
