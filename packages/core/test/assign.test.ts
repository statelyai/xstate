import {
  assign,
  createActor,
  createMachine,
  enqueueActions
} from '../src/index.ts';

interface CounterContext {
  count: number;
  foo: string;
  maybe?: string;
}

const createCounterMachine = (context: Partial<CounterContext> = {}) =>
  createMachine({
    types: {} as { context: CounterContext },
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

    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'DEC'
    });
    const oneState = actorRef.getSnapshot();

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: -1, foo: 'bar' });

    actorRef.send({ type: 'DEC' });
    const twoState = actorRef.getSnapshot();

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: -2, foo: 'bar' });
  });

  it('applies the assignment to the external state', () => {
    const counterMachine = createCounterMachine();

    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'INC'
    });
    const oneState = actorRef.getSnapshot();

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 1, foo: 'bar' });

    actorRef.send({ type: 'INC' });
    const twoState = actorRef.getSnapshot();

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 2, foo: 'bar' });
  });

  it('applies the assignment to multiple properties (property assignment)', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'WIN_PROP'
    });

    expect(actorRef.getSnapshot().context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static)', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'WIN_STATIC'
    });

    expect(actorRef.getSnapshot().context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static + prop assignment)', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'WIN_MIX'
    });

    expect(actorRef.getSnapshot().context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'WIN'
    });

    expect(actorRef.getSnapshot().context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to the explicit external state (property assignment)', () => {
    const machine = createCounterMachine({ count: 50, foo: 'bar' });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'DEC' });
    const oneState = actorRef.getSnapshot();

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 49, foo: 'bar' });

    actorRef.send({ type: 'DEC' });
    const twoState = actorRef.getSnapshot();

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 48, foo: 'bar' });

    const machine2 = createCounterMachine({ count: 100, foo: 'bar' });

    const actorRef2 = createActor(machine2).start();
    actorRef2.send({ type: 'DEC' });
    const threeState = actorRef2.getSnapshot();

    expect(threeState.value).toEqual('counting');
    expect(threeState.context).toEqual({ count: 99, foo: 'bar' });
  });

  it('applies the assignment to the explicit external state', () => {
    const machine = createCounterMachine({ count: 50, foo: 'bar' });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'INC' });
    const oneState = actorRef.getSnapshot();

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 51, foo: 'bar' });

    actorRef.send({ type: 'INC' });
    const twoState = actorRef.getSnapshot();

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 52, foo: 'bar' });

    const machine2 = createCounterMachine({ count: 102, foo: 'bar' });

    const actorRef2 = createActor(machine2).start();
    actorRef2.send({ type: 'INC' });
    const threeState = actorRef2.getSnapshot();

    expect(threeState.value).toEqual('counting');
    expect(threeState.context).toEqual({ count: 103, foo: 'bar' });
  });

  it('should maintain state after unhandled event', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();

    actorRef.send({
      type: 'FAKE_EVENT'
    });
    const nextState = actorRef.getSnapshot();

    expect(nextState.context).toBeDefined();
    expect(nextState.context).toEqual({ count: 0, foo: 'bar' });
  });

  it('sets undefined properties', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();

    actorRef.send({
      type: 'SET_MAYBE'
    });

    const nextState = actorRef.getSnapshot();

    expect(nextState.context.maybe).toBeDefined();
    expect(nextState.context).toEqual({
      count: 0,
      foo: 'bar',
      maybe: 'defined'
    });
  });

  it('can assign from event', () => {
    const machine = createMachine({
      types: {} as {
        context: { count: number };
        events: { type: 'INC'; value: number };
      },
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

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'INC', value: 30 });

    expect(actorRef.getSnapshot().context.count).toEqual(30);
  });
});

describe('assign meta', () => {
  it('should provide the parametrized action to the assigner', () => {
    const machine = createMachine(
      {
        types: {} as {
          actions: { type: 'inc'; params: { by: number } };
        },
        context: { count: 1 },
        entry: {
          type: 'inc',
          params: { by: 10 }
        }
      },
      {
        actions: {
          inc: assign(({ context }, params) => ({
            count: context.count + params.by
          }))
        }
      }
    );

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().context.count).toEqual(11);
  });

  it('should provide the action parameters to the partial assigner', () => {
    const machine = createMachine(
      {
        types: {} as {
          actions: { type: 'inc'; params: { by: number } };
        },
        context: { count: 1 },
        entry: {
          type: 'inc',
          params: { by: 10 }
        }
      },
      {
        actions: {
          inc: assign({
            count: ({ context }, params) => context.count + params.by
          })
        }
      }
    );

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().context.count).toEqual(11);
  });

  it('a parameterized action that resolves to assign() should be provided the params', (done) => {
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
          inc: assign(({ context }, params) => {
            expect(params).toEqual({ value: 5 });
            done();
            return context;
          })
        }
      }
    );

    const service = createActor(machine).start();

    service.send({ type: 'EVENT' });
  });
});
