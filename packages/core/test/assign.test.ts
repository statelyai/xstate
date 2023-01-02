import { interpret, assign, send, sendParent, createMachine } from '../src';
import { ActorRef } from '../src/types';

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
              actions: assign((ctx) => ({
                count: ctx.count + 1
              }))
            }
          ],
          DEC: [
            {
              target: 'counting',
              actions: [
                assign({
                  count: (ctx) => ctx.count - 1
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
                count: (_, event) => event.value
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
  const machine = createMachine<{ count: number }>({
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
              count: action.params?.assignment ? 5 : -1
            }))
          }
        }
      },
      two: {}
    }
  });

  it('should provide the state in regular transitions (prop assigner)', () => {
    const { initialState } = machine;

    const nextState = machine.transition(initialState, { type: 'NEXT' });

    expect(nextState.context).toEqual({ count: 3 });
  });

  it('should provide the state in regular transitions (assigner)', () => {
    const { initialState } = machine;

    const nextState = machine.transition(initialState, { type: 'NEXT_FN' });

    expect(nextState.context).toEqual({ count: 3 });
  });

  it('should provide the assign action', () => {
    const { initialState } = machine;

    const nextState = machine.transition(initialState, {
      type: 'NEXT_ASSIGNER'
    });

    expect(nextState.context).toEqual({ count: 5 });
  });

  it('should provide the pre-initial state when executing initial state actions', () => {
    let receivedCount = Infinity;

    const machine = createMachine<{ count: number }>({
      id: 'assign',
      initial: 'start',
      context: { count: 101 },
      states: {
        start: {
          entry: assign({
            count: (_, __, { state }) => {
              receivedCount = state.context.count;
              return 0;
            }
          })
        }
      }
    });

    interpret(machine).start();

    expect(receivedCount).toBe(101);
  });

  it('should provide meta._event to assigner', () => {
    interface Ctx {
      eventLog: Array<{ event: string; origin?: ActorRef<any> }>;
    }

    const assignEventLog = assign<Ctx>((ctx, event, meta) => ({
      eventLog: ctx.eventLog.concat({
        event: event.type,
        origin: meta._event.origin
      })
    }));

    const childMachine = createMachine({
      initial: 'bar',
      states: {
        bar: {}
      },
      on: {
        PING: {
          actions: [sendParent({ type: 'PONG' })]
        }
      }
    });

    const parentMachine = createMachine<Ctx>({
      initial: 'foo',
      context: {
        eventLog: []
      },
      states: {
        foo: {
          invoke: {
            id: 'child',
            src: childMachine
          }
        }
      },
      on: {
        PING_CHILD: {
          actions: [send({ type: 'PING' }, { to: 'child' }), assignEventLog]
        },
        '*': {
          actions: [assignEventLog]
        }
      }
    });

    let state: any;

    const service = interpret(parentMachine)
      .onTransition((s) => {
        state = s;
      })
      .start();

    service.send({ type: 'PING_CHILD' });
    service.send({ type: 'PING_CHILD' });

    expect(state.context).toMatchInlineSnapshot(`
      Object {
        "eventLog": Array [
          Object {
            "event": "PING_CHILD",
            "origin": undefined,
          },
          Object {
            "event": "PONG",
            "origin": Object {
              "id": "child",
            },
          },
          Object {
            "event": "PING_CHILD",
            "origin": undefined,
          },
          Object {
            "event": "PONG",
            "origin": Object {
              "id": "child",
            },
          },
        ],
      }
    `);
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
            inc: assign((_, __, { action }) => {
              expect(action).toEqual({ type: 'inc', params: { value: 5 } });
              done();
              return _;
            })
          }
        }
      );

      const service = interpret(machine).start();

      service.send({ type: 'EVENT' });
    }
  );
});
