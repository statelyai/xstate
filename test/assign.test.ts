import { assert } from 'chai';
import { Machine, assign } from '../src/index';

interface CounterContext {
  count: number;
  foo: string;
  maybe?: string;
}

const counterMachine = Machine<CounterContext>({
  initial: 'counting',
  context: { count: 0, foo: 'bar' },
  states: {
    counting: {
      on: {
        INC: [
          {
            target: 'counting',
            actions: assign(ctx => ({
              count: ctx.count + 1
            }))
          }
        ],
        DEC: [
          {
            target: 'counting',
            actions: [
              assign({
                count: ctx => ctx.count - 1
              })
            ]
          }
        ],
        WIN_PROP: [
          {
            target: 'counting',
            actions: [
              assign({
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
              assign({
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
              assign({
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
              assign(() => ({
                count: 100,
                foo: 'win'
              }))
            ]
          }
        ],
        SET_MAYBE: [
          {
            actions: [
              assign({
                maybe: 'defined'
              })
            ]
          }
        ]
      }
    }
  }
});

describe('assign', () => {
  it('applies the assignment to the external state (property assignment)', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'DEC'
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.context, { count: -1, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, 'DEC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.context, { count: -2, foo: 'bar' });
  });

  it('applies the assignment to the external state', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'INC'
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.context, { count: 1, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, 'INC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.context, { count: 2, foo: 'bar' });
  });

  it('applies the assignment to multiple properties (property assignment)', () => {
    const nextState = counterMachine.transition(
      counterMachine.initialState,
      'WIN_PROP'
    );

    assert.deepEqual(nextState.context, { count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static)', () => {
    const nextState = counterMachine.transition(
      counterMachine.initialState,
      'WIN_STATIC'
    );

    assert.deepEqual(nextState.context, { count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static + prop assignment)', () => {
    const nextState = counterMachine.transition(
      counterMachine.initialState,
      'WIN_MIX'
    );

    assert.deepEqual(nextState.context, { count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties', () => {
    const nextState = counterMachine.transition(
      counterMachine.initialState,
      'WIN'
    );

    assert.deepEqual(nextState.context, { count: 100, foo: 'win' });
  });

  it('applies the assignment to the explicit external state (property assignment)', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'DEC',
      { count: 50, foo: 'bar' }
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.context, { count: 49, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, 'DEC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.context, { count: 48, foo: 'bar' });

    const threeState = counterMachine.transition(twoState, 'DEC', {
      count: 100,
      foo: 'bar'
    });

    assert.deepEqual(threeState.value, 'counting');
    assert.deepEqual(threeState.context, { count: 99, foo: 'bar' });
  });

  it('applies the assignment to the explicit external state', () => {
    const oneState = counterMachine.transition(
      counterMachine.initialState,
      'INC',
      { count: 50, foo: 'bar' }
    );

    assert.deepEqual(oneState.value, 'counting');
    assert.deepEqual(oneState.context, { count: 51, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, 'INC');

    assert.deepEqual(twoState.value, 'counting');
    assert.deepEqual(twoState.context, { count: 52, foo: 'bar' });

    const threeState = counterMachine.transition(twoState, 'INC', {
      count: 102,
      foo: 'bar'
    });

    assert.deepEqual(threeState.value, 'counting');
    assert.deepEqual(threeState.context, { count: 103, foo: 'bar' });
  });

  it('should maintain state after unhandled event', () => {
    const { initialState } = counterMachine;

    const nextState = counterMachine.transition(initialState, 'FAKE_EVENT');

    assert.isDefined(nextState.context);
    assert.deepEqual(nextState.context, { count: 0, foo: 'bar' });
  });

  it('sets undefined properties', () => {
    const { initialState } = counterMachine;

    const nextState = counterMachine.transition(initialState, 'SET_MAYBE');

    assert.isDefined(nextState.context.maybe);
    assert.deepEqual(nextState.context, {
      count: 0,
      foo: 'bar',
      maybe: 'defined'
    });
  });
});

describe('custom updater', () => {
  const updates: number[] = [];
  interface UpdaterContext {
    count: number;
  }
  const updaterMachine = Machine<UpdaterContext>(
    {
      id: 'updater',
      initial: 'active',
      context: { count: 0 },
      states: {
        active: {
          on: {
            EVENT: {
              actions: [
                assign({
                  count: ctx => ctx.count + 2
                }),
                assign({
                  count: ctx => ctx.count * 2
                })
              ]
            }
          }
        }
      }
    },
    {
      updater: (ctx, _, actions) => {
        const newCtx = { ...ctx };
        actions.forEach(action => {
          Object.keys(action.assignment).forEach(key => {
            newCtx[key] = (action.assignment[key] as (
              _ctx: typeof ctx
            ) => number)(newCtx);

            // Custom functionality
            updates.push(newCtx[key]);
          });
        });

        return newCtx;
      }
    }
  );

  it('should allow a custom updater to update state context', () => {
    const newState = updaterMachine.transition(
      updaterMachine.initialState,
      'EVENT'
    );
    assert.deepEqual(newState.context, { count: 4 });
    assert.deepEqual(updates, [2, 4]);
  });
});

describe('assign meta', () => {
  const machine = Machine<{ count: number }>({
    id: 'assign',
    initial: 'start',
    context: { count: 0 },
    states: {
      start: {
        entry: assign({
          count: (_, __, { state }) => {
            return state === undefined ? 1 : -1;
          }
        }),
        meta: { test: 3 },
        on: {
          NEXT: {
            target: 'two',
            actions: assign({
              count: (_, __, { state }) => {
                return state ? state.meta['assign.start'].test : -1;
              }
            })
          },
          NEXT_FN: {
            target: 'two',
            actions: assign((_, __, { state }) => ({
              count: state ? state.meta['assign.start'].test : -1
            }))
          },
          NEXT_ASSIGNER: {
            target: 'two',
            actions: assign((_, __, { action }) => ({
              count: action.assignment ? 5 : -1
            }))
          }
        }
      },
      two: {}
    }
  });

  it('should provide the state in regular transitions (prop assigner)', () => {
    const { initialState } = machine;

    const nextState = machine.transition(initialState, 'NEXT');

    assert.deepEqual(nextState.context, { count: 3 });
  });

  it('should provide the state in regular transitions (assigner)', () => {
    const { initialState } = machine;

    const nextState = machine.transition(initialState, 'NEXT_FN');

    assert.deepEqual(nextState.context, { count: 3 });
  });

  it('should provide the assign action', () => {
    const { initialState } = machine;

    const nextState = machine.transition(initialState, 'NEXT_ASSIGNER');

    assert.deepEqual(nextState.context, { count: 5 });
  });

  it('should not provide the state from initial state', () => {
    const { initialState } = machine;

    assert.deepEqual(initialState.context, { count: 1 });
  });
});
