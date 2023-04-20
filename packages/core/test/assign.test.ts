import { assign, createMachine, interpret } from '../src/index.ts';

interface CounterContext {
  count: number;
  foo: string;
  maybe?: string;
}

const createCounterMachine = (context: Partial<CounterContext> = {}) =>
  createMachine<CounterContext>({
    initial: 'counting',
    context: { count: 0, foo: 'bar', ...context },
    states: {
      counting: {
        on: {
          INC: [
            {
              target: 'counting',
              actions: assign(({ context }) => ({
                count: context.count + 1
              }))
            }
          ],
          DEC: [
            {
              target: 'counting',
              actions: [
                assign({
                  count: ({ context }) => context.count - 1
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
    const counterMachine = createCounterMachine();

    const oneState = counterMachine.transition(counterMachine.initialState, {
      type: 'DEC'
    });

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: -1, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, { type: 'DEC' });

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: -2, foo: 'bar' });
  });

  it('applies the assignment to the external state', () => {
    const counterMachine = createCounterMachine();

    const oneState = counterMachine.transition(counterMachine.initialState, {
      type: 'INC'
    });

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 1, foo: 'bar' });

    const twoState = counterMachine.transition(oneState, { type: 'INC' });

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 2, foo: 'bar' });
  });

  it('applies the assignment to multiple properties (property assignment)', () => {
    const counterMachine = createCounterMachine();
    const nextState = counterMachine.transition(counterMachine.initialState, {
      type: 'WIN_PROP'
    });

    expect(nextState.context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static)', () => {
    const counterMachine = createCounterMachine();
    const nextState = counterMachine.transition(counterMachine.initialState, {
      type: 'WIN_STATIC'
    });

    expect(nextState.context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static + prop assignment)', () => {
    const counterMachine = createCounterMachine();
    const nextState = counterMachine.transition(counterMachine.initialState, {
      type: 'WIN_MIX'
    });

    expect(nextState.context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties', () => {
    const counterMachine = createCounterMachine();
    const nextState = counterMachine.transition(counterMachine.initialState, {
      type: 'WIN'
    });

    expect(nextState.context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to the explicit external state (property assignment)', () => {
    const machine = createCounterMachine({ count: 50, foo: 'bar' });
    const oneState = machine.transition(undefined, { type: 'DEC' });

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 49, foo: 'bar' });

    const twoState = machine.transition(oneState, { type: 'DEC' });

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 48, foo: 'bar' });

    const machine2 = createCounterMachine({ count: 100, foo: 'bar' });

    const threeState = machine2.transition(undefined, { type: 'DEC' });

    expect(threeState.value).toEqual('counting');
    expect(threeState.context).toEqual({ count: 99, foo: 'bar' });
  });

  it('applies the assignment to the explicit external state', () => {
    const machine = createCounterMachine({ count: 50, foo: 'bar' });
    const oneState = machine.transition(undefined, { type: 'INC' });

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 51, foo: 'bar' });

    const twoState = machine.transition(oneState, { type: 'INC' });

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 52, foo: 'bar' });

    const machine2 = createCounterMachine({ count: 102, foo: 'bar' });

    const threeState = machine2.transition(undefined, { type: 'INC' });

    expect(threeState.value).toEqual('counting');
    expect(threeState.context).toEqual({ count: 103, foo: 'bar' });
  });

  it('should maintain state after unhandled event', () => {
    const counterMachine = createCounterMachine();
    const { initialState } = counterMachine;

    const nextState = counterMachine.transition(initialState, {
      type: 'FAKE_EVENT'
    });

    expect(nextState.context).toBeDefined();
    expect(nextState.context).toEqual({ count: 0, foo: 'bar' });
  });

  it('sets undefined properties', () => {
    const counterMachine = createCounterMachine();
    const { initialState } = counterMachine;

    const nextState = counterMachine.transition(initialState, {
      type: 'SET_MAYBE'
    });

    expect(nextState.context.maybe).toBeDefined();
    expect(nextState.context).toEqual({
      count: 0,
      foo: 'bar',
      maybe: 'defined'
    });
  });

  it('can assign from event', () => {
    const machine = createMachine<
      { count: number },
      { type: 'INC'; value: number }
    >({
      initial: 'active',
      context: {
        count: 0
      },
      states: {
        active: {
          on: {
            INC: {
              actions: assign({
                count: ({ event }) => event.value
              })
            }
          }
        }
      }
    });

    const nextState = machine.transition(undefined, { type: 'INC', value: 30 });

    expect(nextState.context.count).toEqual(30);
  });
});

describe('assign meta', () => {
  it('should provide the parametrized action to the assigner', () => {
    const machine = createMachine(
      {
        context: { count: 1 },
        entry: {
          type: 'inc',
          params: { by: 10 }
        }
      },
      {
        actions: {
          inc: assign(({ context, action }) => ({
            count: context.count + action.params!.by
          }))
        }
      }
    );

    const actor = interpret(machine).start();

    expect(actor.getSnapshot().context.count).toEqual(11);
  });

  it('should provide the parametrized action to the partial assigner', () => {
    const machine = createMachine(
      {
        context: { count: 1 },
        entry: {
          type: 'inc',
          params: { by: 10 }
        }
      },
      {
        actions: {
          inc: assign({
            count: ({ context, action }) => context.count + action.params!.by
          })
        }
      }
    );

    const actor = interpret(machine).start();

    expect(actor.getSnapshot().context.count).toEqual(11);
  });

  it(
    'a parameterized action that resolves to assign() should be provided the original' +
      'action in the action meta',
    (done) => {
      const machine = createMachine(
        {
          on: {
            EVENT: {
              actions: {
                type: 'inc',
                params: { value: 5 }
              }
            }
          }
        },
        {
          actions: {
            inc: assign(({ context, action }) => {
              expect(action).toEqual({ type: 'inc', params: { value: 5 } });
              done();
              return context;
            })
          }
        }
      );

      const service = interpret(machine).start();

      service.send({ type: 'EVENT' });
    }
  );
});
