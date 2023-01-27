/* @jsxImportSource solid-js */
import { useMachine, useService } from '../src/fsm';
import {
  createMachine,
  assign,
  interpret,
  StateMachine,
  InterpreterStatus
} from '@xstate/fsm';
import { screen, render, fireEvent, waitFor } from 'solid-testing-library';
import {
  createEffect,
  createSignal,
  onMount,
  Switch,
  Match,
  on,
  Accessor,
  Component,
  onCleanup
} from 'solid-js';

describe('useMachine hook for fsm', () => {
  const context = {
    data: undefined
  };
  const fetchMachine = createMachine<typeof context, any>({
    id: 'fetch',
    initial: 'idle',
    context,
    states: {
      idle: {
        on: { FETCH: 'loading' }
      },
      loading: {
        entry: ['load'],
        on: {
          RESOLVE: {
            target: 'success',
            actions: assign({
              data: (_, e) => e.data
            })
          }
        }
      },
      success: {}
    }
  });

  const Fetcher = ({
    onFetch = () => new Promise((res) => res('some data'))
  }: {
    onFetch: () => Promise<any>;
  }) => {
    const [current, send] = useMachine(fetchMachine, {
      actions: {
        load: () =>
          onFetch().then((res) => {
            send({ type: 'RESOLVE', data: res });
          })
      }
    });

    return (
      <Switch fallback={null}>
        <Match when={current.matches('idle')}>
          <button onclick={(_) => send({ type: 'FETCH' })}>Fetch</button>;
        </Match>
        <Match when={current.matches('loading')}>
          <div>Loading...</div>
        </Match>
        <Match when={current.matches('success')}>
          Success! Data: <div data-testid="data">{current.context.data}</div>
        </Match>
      </Switch>
    );
  };

  it('should work with the useMachine hook', async () => {
    render(() => (
      <Fetcher onFetch={() => new Promise((res) => res('fake data'))} />
    ));
    const button = screen.getByText('Fetch');
    fireEvent.click(button);
    screen.getByText('Loading...');
    await waitFor(() => screen.getByText(/Success/));
    const dataEl = screen.getByTestId('data');
    expect(dataEl.textContent).toBe('fake data');
  });

  it('should provide the service', () => {
    const Test = () => {
      const [, , service] = useMachine(fetchMachine);

      expect(typeof service.send).toBe('function');

      return null;
    };

    render(() => <Test />);
  });

  it('actions should not have stale data', (done) => {
    const toggleMachine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: { TOGGLE: 'active' }
        },
        active: {
          entry: 'doAction'
        }
      }
    });

    const Toggle = () => {
      const [ext, setExt] = createSignal(false);

      const doAction = () => {
        expect(ext()).toBeTruthy();
        done();
      };

      const [, send] = useMachine(toggleMachine, {
        actions: {
          doAction
        }
      });

      return (
        <div>
          <button
            data-testid="extbutton"
            onClick={(_) => {
              setExt(true);
            }}
          />
          <button
            data-testid="button"
            onClick={(_) => {
              send({ type: 'TOGGLE' });
            }}
          />
        </div>
      );
    };

    render(() => <Toggle />);

    const button = screen.getByTestId('button');
    const extButton = screen.getByTestId('extbutton');
    fireEvent.click(extButton);

    fireEvent.click(button);
  });

  it('should keep options defined on a machine when they are not passed to `useMachine` hook', (done) => {
    let actual = false;

    const toggleMachine = createMachine(
      {
        initial: 'inactive',
        states: {
          inactive: {
            on: { TOGGLE: 'active' }
          },
          active: {
            entry: 'doAction'
          }
        }
      },
      {
        actions: {
          doAction() {
            actual = true;
          }
        }
      }
    );

    const Comp = () => {
      const [, send] = useMachine(toggleMachine);
      onMount(() => {
        send({ type: 'TOGGLE' });
        expect(actual).toEqual(true);
        done();
      });

      return null;
    };

    render(() => <Comp />);
  });

  it('should be able to lookup initial action passed to the hook', (done) => {
    let outer = false;

    const machine = createMachine(
      {
        initial: 'foo',
        states: {
          foo: {
            entry: 'doAction'
          }
        }
      },
      {
        actions: {
          doAction() {
            outer = true;
          }
        }
      }
    );

    const Comp = () => {
      let inner = false;

      useMachine(machine, {
        actions: {
          doAction() {
            inner = true;
          }
        }
      });

      onMount(() => {
        expect(outer).toBe(false);
        expect(inner).toBe(true);
        done();
      });

      return null;
    };

    render(() => <Comp />);
  });

  it('should not change actions configured on a machine itself', () => {
    let flag = false;

    const machine = createMachine(
      {
        initial: 'foo',
        states: {
          foo: {
            on: {
              EV: 'bar'
            }
          },
          bar: {
            entry: 'doAction'
          }
        }
      },
      {
        actions: {
          doAction() {
            flag = true;
          }
        }
      }
    );

    const Comp = () => {
      useMachine(machine, {
        actions: {
          doAction() {
            //
          }
        }
      });

      return null;
    };

    render(() => <Comp />);

    const service = interpret(machine).start();
    service.send({ type: 'EV' });
    expect(flag).toBe(true);
  });

  it('should capture only nested value update', () => {
    const machine = createMachine<
      { item: { count: number; total: number } },
      { type: 'COUNT' } | { type: 'TOTAL' }
    >({
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
            COUNT: {
              actions: [
                assign({
                  item: (ctx) => ({ ...ctx.item, count: ctx.item.count + 1 })
                })
              ]
            },
            TOTAL: {
              actions: [
                assign({
                  item: (ctx) => ({ ...ctx.item, total: ctx.item.total + 1 })
                })
              ]
            }
          }
        }
      }
    });

    const App = () => {
      const [stateCount, setStateCount] = createSignal(0);
      const [state, send] = useMachine(machine);
      createEffect(
        on(
          () => state.context.item.count,
          () => {
            setStateCount((c) => c + 1);
          },
          { defer: true }
        )
      );
      onMount(() => {
        send({ type: 'COUNT' });
        send({ type: 'TOTAL' });
        send({ type: 'COUNT' });
        send({ type: 'TOTAL' });
      });

      return <div data-testid="count">{stateCount()}</div>;
    };

    render(() => <App />);

    const countEl = screen.getByTestId('count');

    // Effect should only trigger once for the COUNT events:
    expect(countEl.textContent).toEqual('1');
  });

  it('fsm useMachine should be updated when it changes shallow', () => {
    const counterMachine = createMachine<{ count: number }>({
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
    });
    const counterService1 = interpret(counterMachine).start();
    const counterService2 = interpret(counterMachine).start();

    const Counter: Component<{
      counterRef: Accessor<StateMachine.Service<any, any>>;
    }> = (props) => {
      const [state, send] = useService(props.counterRef);

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="count">{state.context.count}</div>
        </div>
      );
    };
    const CounterParent = () => {
      const [service, setService] = createSignal(counterService1);

      return (
        <div>
          <button
            data-testid="change-service"
            onclick={() => setService(counterService2)}
          />
          <Counter counterRef={service} />
        </div>
      );
    };

    render(() => <CounterParent />);

    const changeServiceButton = screen.getByTestId('change-service');
    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
    fireEvent.click(changeServiceButton);
    expect(countEl.textContent).toBe('0');
  });

  it('useMachine state should only trigger effect of directly tracked value', () => {
    const counterMachine2 = createMachine<{
      subCount: { subCount1: { subCount2: { count: number } } };
    }>({
      id: 'counter2',
      initial: 'active',
      context: { subCount: { subCount1: { subCount2: { count: 0 } } } },
      states: {
        active: {
          on: {
            INC: {
              actions: assign({
                subCount: (ctx) => ({
                  ...ctx.subCount,
                  subCount1: {
                    ...ctx.subCount.subCount1,
                    subCount2: {
                      ...ctx.subCount.subCount1.subCount2,
                      count: ctx.subCount.subCount1.subCount2.count + 1
                    }
                  }
                })
              })
            },
            SOMETHING: { actions: 'doSomething' }
          }
        }
      }
    });
    const Counter = () => {
      const [state, send] = useMachine(counterMachine2);
      const [effectCount, setEffectCount] = createSignal(0);
      createEffect(
        on(
          () => state.context.subCount.subCount1,
          () => {
            setEffectCount((prev) => prev + 1);
          },
          {
            defer: true
          }
        )
      );
      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="effect-count">{effectCount()}</div>
          <div data-testid="count">
            {state.context.subCount.subCount1.subCount2.count}
          </div>
        </div>
      );
    };

    render(() => <Counter />);

    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');
    const effectCountEl = screen.getByTestId('effect-count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
    expect(effectCountEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('2');
    expect(effectCountEl.textContent).toBe('0');
  });

  it('referenced object in context should not update both machines', () => {
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
      const [state1, send1] = useMachine(machine);
      const [state2, send2] = useMachine(machine);

      return (
        <div>
          <div>
            <button
              data-testid="inc-machine1"
              onclick={() => send1({ type: 'INC' })}
            >
              INC 1
            </button>
            <div data-testid="value-machine1">
              {state1.context.latestValue.value}
            </div>
          </div>
          <div>
            <button
              data-testid="inc-machine2"
              onclick={() => send2({ type: 'INC' })}
            >
              INC 1
            </button>
            <div data-testid="value-machine2">
              {state2.context.latestValue.value}
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
  });

  it('send should update synchronously', (done) => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            done: 'success'
          }
        },
        success: {}
      }
    });

    const Spawner = () => {
      const [current, send] = useMachine(machine);
      onMount(() => {
        expect(current.value).toBe('start');
        send({ type: 'done' });
        expect(current.value).toBe('success');
      });

      return (
        <Switch fallback={null}>
          <Match when={current.value === 'start'}>
            <span data-testid="start" />
          </Match>
          <Match when={current.value === 'success'}>
            <span data-testid="success" />
          </Match>
        </Switch>
      );
    };

    render(() => <Spawner />);
    waitFor(() => screen.getByTestId('success')).then(() => done());
  });

  // Example from: https://github.com/davidkpiano/xstate/discussions/1944
  it('fsm useMachine service should be typed correctly', () => {
    interface Context {
      count?: number;
    }

    interface Event {
      type: 'READY';
    }

    type State =
      | {
          value: 'idle';
          context: Context & {
            count: undefined;
          };
        }
      | {
          value: 'ready';
          context: Context & {
            count: number;
          };
        };

    type Service = StateMachine.Service<Context, Event, State>;

    const machine = createMachine<Context, Event, State>({
      id: 'machine',
      initial: 'idle',
      context: {
        count: undefined
      },
      states: {
        idle: {},
        ready: {}
      }
    });

    const useCustomService = (service: Service) => createEffect(() => service);

    function App() {
      const [, , service] = useMachine(machine);

      useCustomService(service);

      return null;
    }

    const noop = (_val: any) => {
      /* ... */
    };

    noop(App);
  });

  it('Service should stop on component cleanup', (done) => {
    jest.useFakeTimers();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EV: {
              target: 'b'
            }
          }
        },
        b: {}
      }
    });

    const Display = () => {
      const [state, , service] = useMachine(machine);
      onCleanup(() => {
        expect(service.status).toBe(InterpreterStatus.Stopped);
        done();
      });

      return <div>{state.toString()}</div>;
    };
    const Counter = () => {
      const [show, setShow] = createSignal(true);
      setTimeout(() => setShow(false), 100);

      return <div>{show() ? <Display /> : null}</div>;
    };

    render(() => <Counter />);
    jest.advanceTimersByTime(100);
  });

  it(`should not reevaluate a scope depending on state.matches when state.value doesn't change`, (done) => {
    jest.useFakeTimers();

    interface MachineContext {
      counter: number;
    }

    const machine = createMachine<MachineContext>({
      context: {
        counter: 0
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            INC: {
              actions: assign({
                counter: (ctx) => ctx.counter + 1
              })
            }
          }
        }
      }
    });

    const Comp = () => {
      let calls = 0;
      const [state, send] = useMachine(machine);

      createEffect(() => {
        calls++;
        state.matches('foo');
      });

      onMount(() => {
        send({ type: 'INC' });
        send({ type: 'INC' });
        send({ type: 'INC' });
        setTimeout(() => {
          send({ type: 'INC' });
          setTimeout(() => {
            send({ type: 'INC' });
            setTimeout(() => {
              expect(calls).toBe(1);
              done();
            }, 100);
          });
        });
      });

      return null;
    };

    render(() => <Comp />);
    jest.advanceTimersByTime(100);
  });
});
