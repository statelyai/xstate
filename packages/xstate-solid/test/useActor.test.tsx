/* @jsxImportSource solid-js */
import { useMachine, useActor } from '../src';
import {
  createMachine,
  sendParent,
  assign,
  spawn,
  ActorRef,
  ActorRefFrom,
  interpret
} from 'xstate';
import { fireEvent, screen, render } from 'solid-testing-library';
import { toActorRef } from 'xstate/lib/Actor';
import { Component, createEffect, createSignal, on, onMount } from 'solid-js';

describe('useActor', () => {
  it('initial invoked actor should be immediately available', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {}
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state] = useActor(props.actor);

      expect(state().value).toEqual('active');
      done();

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      return (
        <ChildTest
          actor={state.children.child as ActorRefFrom<typeof childMachine>}
        />
      );
    };

    render(() => <Test />);
  });

  it('invoked actor should be able to receive (deferred) events that it replays when active', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent('FINISH') }
          }
        }
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state, send] = useActor(props.actor);

      expect(state().value).toEqual('active');

      send({ type: 'FINISH' });

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      createEffect(() => {
        if (state.matches('success')) {
          done();
        }
      });

      return (
        <ChildTest
          actor={state.children.child as ActorRefFrom<typeof childMachine>}
        />
      );
    };

    render(() => <Test />);
  });

  it('should only trigger effects once for nested context values', (done) => {
    const childMachine = createMachine<{
      item: { count: number; total: number };
    }>({
      id: 'childMachine',
      initial: 'active',
      context: {
        item: {
          count: 0,
          total: 0
        }
      },
      states: {
        active: {
          on: {
            FINISH: {
              actions: [
                assign({
                  item: (ctx) => ({ ...ctx.item, total: ctx.item.total + 1 })
                }),

                sendParent('FINISH')
              ]
            },
            COUNT: {
              actions: [
                assign({
                  item: (ctx) => ({ ...ctx.item, count: ctx.item.count + 1 })
                })
              ]
            }
          }
        }
      }
    });
    const machine = createMachine<{
      actorRef?: ActorRefFrom<typeof childMachine>;
    }>({
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: () => spawn(childMachine)
          }),
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest = (props: {
      actor: Readonly<ActorRefFrom<typeof childMachine>>;
    }) => {
      const [state, send] = useActor(props.actor);
      const [count, setCount] = createSignal(0);
      const [total, setTotal] = createSignal(0);
      createEffect(
        on(
          () => state().context.item.count,
          () => {
            setCount(() => count() + 1);
          },
          { defer: true }
        )
      );

      createEffect(
        on(
          () => state().context.item.total,
          () => {
            setTotal(() => count() + 1);
          },
          { defer: true }
        )
      );

      onMount(() => {
        send('COUNT');
        send({ type: 'FINISH' });
      });

      return (
        <div>
          <div data-testid="count">{count()}</div>
          <div data-testid="total">{total()}</div>
        </div>
      );
    };

    const Test = () => {
      const [state] = useMachine(machine);

      return <ChildTest actor={state.context.actorRef!} />;
    };

    render(() => <Test />);
    const countEl = screen.getByTestId('count');
    const totalEl = screen.getByTestId('total');

    // Effect should only trigger once for the count and total:
    expect(countEl.textContent).toEqual('1');
    expect(totalEl.textContent).toEqual('1');
    done();
  });

  it('initial spawned actor should be immediately available', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });

    interface Ctx {
      actorRef?: ActorRefFrom<typeof childMachine>;
    }

    const machine = createMachine<Ctx>({
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: () => spawn(childMachine)
          })
        }
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state] = useActor(props.actor);

      expect(state().value).toEqual('active');

      done();

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      const { actorRef } = state.context;

      return <ChildTest actor={actorRef!} />;
    };

    render(() => <Test />);
  });

  it('spawned actor should be able to receive (deferred) events that it replays when active', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent('FINISH') }
          }
        }
      }
    });
    const machine = createMachine<{
      actorRef?: ActorRefFrom<typeof childMachine>;
    }>({
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: () => spawn(childMachine)
          }),
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest = (props: { actor: ActorRefFrom<typeof childMachine> }) => {
      const [state, send] = useActor(props.actor);
      createEffect(() => {
        expect(state().value).toEqual('active');
      });

      onMount(() => {
        send({ type: 'FINISH' });
      });

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      createEffect(() => {
        if (state.matches('success')) {
          done();
        }
      });

      return <ChildTest actor={state.context.actorRef!} />;
    };

    render(() => <Test />);
  });

  it('actor should provide snapshot value immediately', () => {
    const simpleActor = toActorRef({
      send: () => {
        /* ... */
      },
      latestValue: 42,
      subscribe: () => {
        return {
          unsubscribe: () => {
            /* ... */
          }
        };
      }
    }) as ActorRef<any, number> & {
      latestValue: number;
    };

    const Test = () => {
      const [state] = useActor(simpleActor, (a) => a.latestValue);

      return <div data-testid="state">{state()}</div>;
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');

    expect(div.textContent).toEqual('42');
  });

  it('should provide value from `actor.getSnapshot()`', () => {
    const simpleActor = toActorRef({
      id: 'test',
      send: () => {
        /* ... */
      },
      getSnapshot: () => 42,
      subscribe: () => {
        return {
          unsubscribe: () => {
            /* ... */
          }
        };
      }
    });

    const Test = () => {
      const [state] = useActor(simpleActor);

      return <div data-testid="state">{state()}</div>;
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');

    expect(div.textContent).toEqual('42');
  });

  it('should update snapshot value when actor changes', () => {
    const createSimpleActor = (value: number) =>
      toActorRef({
        send: () => {
          /* ... */
        },
        latestValue: value,
        subscribe: () => {
          return {
            unsubscribe: () => {
              /* ... */
            }
          };
        }
      }) as ActorRef<any> & { latestValue: number };

    const Test = () => {
      const [actor, setActor] = createSignal(createSimpleActor(42));
      const [state] = useActor(actor, (a) => a.latestValue);

      return (
        <div>
          <div data-testid="state">{state()}</div>
          <button
            data-testid="button"
            onclick={() => setActor(createSimpleActor(100))}
          />
        </div>
      );
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');
    const button = screen.getByTestId('button');

    expect(div.textContent).toEqual('42');
    fireEvent.click(button);
    expect(div.textContent).toEqual('100');
  });

  it('send() should be stable', (done) => {
    jest.useFakeTimers();
    const fakeSubscribe = () => {
      return {
        unsubscribe: () => {
          /* ... */
        }
      };
    };
    const noop = () => {
      /* ... */
    };
    const firstActor = toActorRef({
      send: noop,
      subscribe: fakeSubscribe
    });
    const lastActor = toActorRef({
      send: () => {
        done();
      },
      subscribe: fakeSubscribe
    });

    const Test = () => {
      const [actor, setActor] = createSignal(firstActor);
      const [, send] = useActor(actor);

      onMount(() => {
        setTimeout(() => {
          // The `send` here is closed-in
          send({ type: 'anything' });
        }, 10);
      }); // Intentionally omit `send` from dependency array

      return (
        <button data-testid="button" onclick={() => setActor(lastActor)} />
      );
    };

    render(() => <Test />);

    // At this point, `send` refers to the first (noop) actor

    const button = screen.getByTestId('button');
    fireEvent.click(button);
    done();
    // At this point, `send` refers to the last actor
    // The effect will call the closed-in `send`, which originally
    // was the reference to the first actor. Now that `send` is stable,
    // it will always refer to the latest actor.
  });

  it('should also work with services', () => {
    const counterMachine = createMachine<
      { count: number },
      { type: 'INC' } | { type: 'SOMETHING' }
    >(
      {
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              INC: { actions: assign({ count: (ctx) => ctx.count + 1 }) },
              SOMETHING: { actions: 'doSomething' }
            }
          }
        }
      },
      {
        actions: {
          doSomething: () => {
            /* do nothing */
          }
        }
      }
    );
    const counterService = interpret(counterMachine).start();

    const Counter = () => {
      const [state, send] = useActor(counterService);

      return (
        <div
          data-testid="count"
          onclick={() => {
            send('INC');
            // @ts-expect-error
            send('FAKE');
          }}
        >
          {state().context.count}
        </div>
      );
    };

    render(() => (
      <div>
        <Counter />
        <Counter />
      </div>
    ));

    const countEls = screen.getAllByTestId('count');

    expect(countEls.length).toBe(2);

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('0');
    });

    counterService.send({ type: 'INC' });

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('1');
    });
  });

  it('referenced object in context should not update both services', (done) => {
    const latestValue = { value: 100 };
    interface Context {
      latestValue: { value: number };
    }
    const machine = createMachine<Context, { type: 'INC' }>({
      initial: 'initial',
      context: {
        latestValue
      },
      states: {
        initial: {
          on: {
            INC: {
              actions: [
                assign({
                  latestValue: (ctx: Context) => ({
                    value: ctx.latestValue.value + 1
                  })
                })
              ]
            }
          }
        }
      }
    });

    const Test = () => {
      const service1 = interpret(machine).start();
      const service2 = interpret(machine).start();
      const [state1, send1] = useActor(service1);
      const [state2, send2] = useActor(service2);

      return (
        <div>
          <div>
            <button data-testid="inc-machine1" onclick={() => send1('INC')}>
              INC 1
            </button>
            <div data-testid="value-machine1">
              {state1().context.latestValue.value}
            </div>
          </div>
          <div>
            <button data-testid="inc-machine2" onclick={() => send2('INC')}>
              INC 1
            </button>
            <div data-testid="value-machine2">
              {state2().context.latestValue.value}
            </div>
          </div>
        </div>
      );
    };

    render(() => <Test />);

    const machine1Value = screen.getByTestId('value-machine1');
    const machine2Value = screen.getByTestId('value-machine2');
    const incMachine1 = screen.getByTestId('inc-machine1');
    const incMachine2 = screen.getByTestId('inc-machine2');

    expect(machine1Value.textContent).toEqual('100');
    expect(machine2Value.textContent).toEqual('100');

    fireEvent.click(incMachine1);

    expect(machine1Value.textContent).toEqual('101');
    expect(machine2Value.textContent).toEqual('100');

    fireEvent.click(incMachine2);

    expect(machine1Value.textContent).toEqual('101');
    expect(machine2Value.textContent).toEqual('101');
    done();
  });

  it('should work with initially deferred actors spawned in lazy context', () => {
    const childMachine = createMachine({
      initial: 'one',
      states: {
        one: {
          on: { NEXT: 'two' }
        },
        two: {}
      }
    });

    const machine = createMachine<{ ref: ActorRef<any> }>({
      context: () => ({
        ref: spawn(childMachine)
      }),
      initial: 'waiting',
      states: {
        waiting: {
          on: { TEST: 'success' }
        },
        success: {
          type: 'final'
        }
      }
    });

    const App = () => {
      const [state] = useMachine(machine);
      const [childState, childSend] = useActor(state.context.ref);

      return (
        <div>
          <div data-testid="child-state">{childState().value}</div>
          <button data-testid="child-send" onclick={() => childSend('NEXT')} />
        </div>
      );
    };

    render(() => <App />);

    const elState = screen.getByTestId('child-state');
    const elSend = screen.getByTestId('child-send');
    expect(elState.textContent).toEqual('one');
    fireEvent.click(elSend);

    expect(elState.textContent).toEqual('two');
  });
});
