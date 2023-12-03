/* @jsxImportSource solid-js */
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  mergeProps,
  on,
  onCleanup,
  onMount
} from 'solid-js';
import { fireEvent, render, screen, waitFor } from 'solid-testing-library';
import {
  Actor,
  ActorLogicFrom,
  assign,
  createActor,
  createMachine,
  raise
} from 'xstate';
import { fromCallback, fromPromise } from 'xstate/actors';
import { useActor, useMachine } from '../src';

afterEach(() => {
  jest.useRealTimers();
});

describe('useMachine hook', () => {
  const context = {
    data: undefined as string | undefined
  };
  const fetchMachine = createMachine({
    id: 'fetch',
    types: {} as {
      context: typeof context;
      events: { type: 'FETCH' };
      actors: {
        src: 'fetchData';
        logic: ActorLogicFrom<Promise<string>>;
      };
    },
    initial: 'idle',
    context,
    states: {
      idle: {
        on: { FETCH: 'loading' }
      },
      loading: {
        invoke: {
          id: 'fetchData',
          src: 'fetchData',
          onDone: {
            target: 'success',
            actions: assign({
              data: ({ event }) => event.output
            }),
            guard: ({ event }) => !!event.output.length
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  const actorRef = createActor(
    fetchMachine.provide({
      actors: {
        fetchData: createMachine({
          initial: 'done',
          states: {
            done: {
              type: 'final'
            }
          },
          output: 'persisted data'
        }) as any
      }
    })
  ).start();
  actorRef.send({ type: 'FETCH' });

  const persistedFetchState = actorRef.getPersistedSnapshot();

  const Fetcher = (props: {
    onFetch: () => Promise<any>;
    persistedState?: typeof persistedFetchState;
  }) => {
    const mergedProps = mergeProps(
      {
        onFetch: () => new Promise((res) => res('some data'))
      },
      props
    );
    const [current, send] = useMachine(fetchMachine, {
      actors: {
        fetchData: fromPromise(mergedProps.onFetch)
      },
      snapshot: mergedProps.persistedState
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

  it('should work with the useMachine hook (rehydrated state)', async () => {
    render(() => (
      <Fetcher
        onFetch={() => new Promise((res) => res('fake data'))}
        persistedState={persistedFetchState}
      />
    ));

    await waitFor(() => screen.getByText(/Success/));
    const dataEl = screen.getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should work with the useMachine hook (rehydrated state config)', async () => {
    const persistedFetchStateConfig = JSON.parse(
      JSON.stringify(persistedFetchState)
    );
    render(() => (
      <Fetcher
        onFetch={() => new Promise((res) => res('fake data'))}
        persistedState={persistedFetchStateConfig}
      />
    ));

    await waitFor(() => screen.getByText(/Success/));
    const dataEl = screen.getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should provide the service', () => {
    const Test = () => {
      const [, , service] = useMachine(fetchMachine);

      if (!(service instanceof Actor)) {
        throw new Error('service not instance of Interpreter');
      }

      return null;
    };

    render(() => <Test />);
  });

  it('should accept input', () => {
    const testMachine = createMachine({
      types: {} as {
        context: { foo: string; test: boolean };
        input: { test?: boolean };
      },
      context: ({ input }) => ({
        foo: 'bar',
        test: false,
        ...input
      }),
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    const Test = () => {
      const [state] = useMachine(testMachine, {
        input: { test: true }
      });

      expect(state.context).toEqual({
        foo: 'bar',
        test: true
      });

      return null;
    };

    render(() => <Test />);
  });

  it('should not spawn actors until service is started', (done) => {
    const spawnMachine = createMachine({
      types: {} as { context: any },
      id: 'spawn',
      initial: 'start',
      context: { ref: undefined },
      states: {
        start: {
          entry: assign({
            ref: ({ spawn }) =>
              spawn(
                fromPromise(() => new Promise((res) => res(42))),
                { id: 'my-promise' }
              )
          }),
          on: {
            'xstate.done.actor.my-promise': 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const Spawner = () => {
      const [current] = useMachine(spawnMachine);

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

  it('send should update synchronously', (done) => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            done: 'success'
          }
        },
        success: {
          type: 'final'
        }
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

  it('actions should not have stale data', (done) => {
    const toggleMachine = createMachine({
      types: {} as {
        events: { type: 'TOGGLE' };
      },
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
            onclick={(_) => {
              setExt(true);
            }}
          />
          <button
            data-testid="button"
            onclick={(_) => {
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

  it('should capture all actions', () => {
    let count = 0;

    const machine = createMachine({
      types: {} as {
        events: { type: 'EVENT' };
      },
      initial: 'active',
      context: { count: 0 },
      states: {
        active: {
          on: {
            EVENT: {
              actions: [
                () => {
                  count++;
                },
                assign({ count: ({ context }) => context.count + 1 })
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
          () => state.context.count,
          () => {
            setStateCount((c) => c + 1);
          }
        )
      );
      onMount(() => {
        send({ type: 'EVENT' });
        send({ type: 'EVENT' });
        send({ type: 'EVENT' });
        send({ type: 'EVENT' });
      });

      return <div data-testid="count">{stateCount()}</div>;
    };

    render(() => <App />);

    const countEl = screen.getByTestId('count');

    // Component should only rerender twice:
    // - 1 time for the initial state
    // - and 1 time for the four (batched) events
    expect(countEl.textContent).toEqual('2');
    expect(count).toEqual(4);
  });

  it('should capture only array updates', () => {
    const machine = createMachine({
      types: {} as {
        context: {
          item: {
            counts: Array<{ value: number }>;
            totals: Array<{ value: number }>;
          };
        };
        events: { type: 'COUNT' } | { type: 'TOTAL' };
      },
      initial: 'active',
      context: {
        item: {
          counts: [{ value: 0 }],
          totals: [{ value: 0 }]
        }
      },
      states: {
        active: {
          on: {
            COUNT: {
              actions: [
                assign({
                  item: ({ context }) => ({
                    ...context.item,
                    counts: [
                      ...context.item.counts,
                      { value: context.item.counts.length + 1 }
                    ]
                  })
                })
              ]
            },
            TOTAL: {
              actions: [
                assign({
                  item: ({ context }) => ({
                    ...context.item,
                    totals: [
                      ...context.item.totals,
                      { value: context.item.totals.length + 1 }
                    ]
                  })
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
          () => [...state.context.item.counts],
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

  it('useMachine state should only trigger effect of directly tracked value', () => {
    const counterMachine2 = createMachine({
      types: {} as {
        context: {
          subCount: { subCount1: { subCount2: { count: number } } };
        };
      },
      id: 'counter',
      initial: 'active',
      context: { subCount: { subCount1: { subCount2: { count: 0 } } } },
      states: {
        active: {
          on: {
            INC: {
              actions: assign({
                subCount: ({ context }) => ({
                  ...context.subCount,
                  subCount1: {
                    ...context.subCount.subCount1,
                    subCount2: {
                      ...context.subCount.subCount1.subCount2,
                      count: context.subCount.subCount1.subCount2.count + 1
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

  it('should capture only nested value update', () => {
    const machine = createMachine({
      types: {} as {
        context: { item: { count: number; total: number } };
        events: { type: 'COUNT' } | { type: 'TOTAL' };
      },
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
                  item: ({ context }) => ({
                    ...context.item,
                    count: context.item.count + 1
                  })
                })
              ]
            },
            TOTAL: {
              actions: [
                assign({
                  item: ({ context }) => ({
                    ...context.item,
                    total: context.item.total + 1
                  })
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

  it('should capture initial actions', () => {
    let count = 0;

    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          entry: () => {
            count++;
          }
        }
      }
    });

    const App = () => {
      useMachine(machine);

      return <div />;
    };

    render(() => <App />);

    expect(count).toEqual(1);
  });

  it('should be reactive to toJSON method calls', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          on: {
            TRANSITION: 'yellow'
          }
        },
        yellow: {
          on: {
            TRANSITION: 'red'
          }
        },
        red: {
          on: {
            TRANSITION: 'green'
          }
        }
      }
    });

    const App = () => {
      const [state, send] = useMachine(machine);
      const [toJson, setToJson] = createSignal(state.toJSON());
      createEffect(
        on(
          () => state.value,
          () => {
            setToJson(state.toJSON());
          }
        )
      );
      return (
        <div>
          <button
            data-testid="transition-button"
            onclick={() => send({ type: 'TRANSITION' })}
          />
          <div data-testid="to-json">{(toJson() as any).value.toString()}</div>
        </div>
      );
    };

    render(() => <App />);
    const toJsonEl = screen.getByTestId('to-json');
    const transitionBtn = screen.getByTestId('transition-button');

    // Green
    expect(toJsonEl.textContent).toEqual('green');
    transitionBtn.click();

    // Yellow
    expect(toJsonEl.textContent).toEqual('yellow');
    transitionBtn.click();

    // Red
    expect(toJsonEl.textContent).toEqual('red');
    transitionBtn.click();

    // Green
    expect(toJsonEl.textContent).toEqual('green');
  });

  it('should be reactive to hasTag method calls', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          tags: 'go',
          on: {
            TRANSITION: 'yellow'
          }
        },
        yellow: {
          tags: 'go',
          on: {
            TRANSITION: 'red'
          }
        },
        red: {
          tags: ['stop', 'other'],
          on: {
            TRANSITION: 'green'
          }
        }
      }
    });

    const App = () => {
      const [state, send] = useMachine(machine);
      const [canGo, setCanGo] = createSignal(state.hasTag('go'));
      createEffect(() => {
        setCanGo(state.hasTag('go'));
      });
      return (
        <div>
          <button
            data-testid="transition-button"
            onclick={() => send({ type: 'TRANSITION' })}
          />
          <div data-testid="can-go">{canGo().toString()}</div>
          <div data-testid="stop">{state.hasTag('stop').toString()}</div>
        </div>
      );
    };

    render(() => <App />);
    const canGoEl = screen.getByTestId('can-go');
    const stopEl = screen.getByTestId('stop');
    const transitionBtn = screen.getByTestId('transition-button');

    // Green
    expect(canGoEl.textContent).toEqual('true');
    expect(stopEl.textContent).toEqual('false');
    transitionBtn.click();

    // Yellow
    expect(canGoEl.textContent).toEqual('true');
    expect(stopEl.textContent).toEqual('false');
    transitionBtn.click();

    // Red
    expect(canGoEl.textContent).toEqual('false');
    expect(stopEl.textContent).toEqual('true');
    transitionBtn.click();

    // Green
    expect(canGoEl.textContent).toEqual('true');
    expect(stopEl.textContent).toEqual('false');
  });

  it('should be reactive to can method calls', () => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            TOGGLE: 'active'
          }
        },
        active: {
          on: {
            DO_SOMETHING: { actions: ['something'] }
          }
        }
      }
    });

    const App = () => {
      const [state, send] = useMachine(machine);
      const [canToggle, setCanToggle] = createSignal(
        state.can({ type: 'TOGGLE' })
      );
      createEffect(() => {
        setCanToggle(state.can({ type: 'TOGGLE' }));
      });
      return (
        <div>
          <button
            data-testid="toggle-button"
            onclick={() => send({ type: 'TOGGLE' })}
          />
          <div data-testid="can-toggle">{canToggle().toString()}</div>
          <div data-testid="can-do-something">
            {state.can({ type: 'DO_SOMETHING' }).toString()}
          </div>
        </div>
      );
    };

    render(() => <App />);
    const canToggleEl = screen.getByTestId('can-toggle');
    const canDoSomethingEl = screen.getByTestId('can-do-something');
    const toggleBtn = screen.getByTestId('toggle-button');

    expect(canToggleEl.textContent).toEqual('true');
    expect(canDoSomethingEl.textContent).toEqual('false');
    toggleBtn.click();
    expect(canToggleEl.textContent).toEqual('false');
    expect(canDoSomethingEl.textContent).toEqual('true');
  });

  it(`should not reevaluate a scope depending on state.matches when state.value doesn't change`, (done) => {
    interface MachineContext {
      counter: number;
    }

    const machine = createMachine({
      types: {} as { context: MachineContext },
      context: {
        counter: 0
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            INC: {
              actions: assign({
                counter: ({ context }) => context.counter + 1
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
  });

  it('should successfully spawn actors from the lazily declared context', () => {
    let childSpawned = false;

    const machine = createMachine({
      context: ({ spawn }) => ({
        ref: spawn(
          fromCallback(() => {
            childSpawned = true;
            return () => {};
          })
        )
      })
    });

    const App = () => {
      useMachine(machine);
      return null;
    };

    render(() => <App />);

    expect(childSpawned).toBe(true);
  });

  it('should be able to use an action provided outside of SolidJS', () => {
    let actionCalled = false;

    const machine = createMachine(
      {
        on: {
          EV: {
            actions: 'foo'
          }
        }
      },
      {
        actions: {
          foo: () => (actionCalled = true)
        }
      }
    );

    const App = () => {
      const [, send] = useMachine(machine);
      send({ type: 'EV' });
      return null;
    };

    render(() => <App />);

    expect(actionCalled).toBe(true);
  });

  it('should be able to use a guard provided outside of SolidJS', () => {
    let guardCalled = false;

    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EV: {
                guard: 'isAwesome',
                target: 'b'
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          isAwesome: () => {
            guardCalled = true;
            return true;
          }
        }
      }
    );

    const App = () => {
      const [_state, send] = useMachine(machine);
      send({ type: 'EV' });
      return null;
    };

    render(() => <App />);

    expect(guardCalled).toBe(true);
  });

  it('should be able to use a service provided outside of SolidJS', () => {
    let serviceCalled = false;

    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EV: 'b'
            }
          },
          b: {
            invoke: {
              src: 'foo'
            }
          }
        }
      },
      {
        actors: {
          foo: fromPromise(() => {
            serviceCalled = true;
            return Promise.resolve();
          })
        }
      }
    );

    const App = () => {
      const [, send] = useMachine(machine);
      send({ type: 'EV' });
      return null;
    };

    render(() => <App />);

    expect(serviceCalled).toBe(true);
  });

  it('should be able to use a delay provided outside of SolidJS', () => {
    jest.useFakeTimers();

    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EV: 'b'
            }
          },
          b: {
            after: {
              myDelay: 'c'
            }
          },
          c: {}
        }
      },
      {
        delays: {
          myDelay: () => {
            return 300;
          }
        }
      }
    );

    const App = () => {
      const [state, send] = useMachine(machine);
      return (
        <div>
          <div data-testid="result">
            {typeof state.value === 'string'
              ? state.value
              : state.value.toString()}
          </div>
          <button role="button" onclick={() => send({ type: 'EV' })} />
        </div>
      );
    };

    render(() => <App />);

    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(screen.getByTestId('result').textContent).toBe('b');

    jest.advanceTimersByTime(310);

    expect(screen.getByTestId('result').textContent).toBe('c');
  });

  it('should not use stale data in a guard', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EV: {
              guard: 'isAwesome',
              target: 'b'
            }
          }
        },
        b: {}
      }
    });

    const App = (props: { isAwesome: boolean }) => {
      const [state, send] = useMachine(machine, {
        guards: {
          isAwesome: () => props.isAwesome
        }
      });
      return (
        <div>
          <div data-testid="result">{state.value.toString()}</div>
          <button
            data-testid="ev-button"
            onclick={() => send({ type: 'EV' })}
          />
        </div>
      );
    };

    const Container = () => {
      const [isAwesome, setIsAwesome] = createSignal(false);
      onMount(() => setIsAwesome(true));
      return <App isAwesome={isAwesome()} />;
    };

    render(() => <Container />);

    const btn = screen.getByTestId('ev-button');
    fireEvent.click(btn);

    expect(screen.getByTestId('result').textContent).toBe('b');
  });

  it('should use updated function value', () => {
    function getValue() {
      return 2;
    }

    const machine = createMachine({
      types: {} as { context: { getValue: () => number } },
      initial: 'a',
      context: {
        getValue() {
          return 1;
        }
      },
      states: {
        a: {
          on: {
            CHANGE: {
              actions: assign(() => ({ getValue }))
            }
          }
        }
      }
    });

    const App = () => {
      const [state, send] = useMachine(machine);

      return (
        <div>
          <div data-testid="result">{state.context.getValue()}</div>
          <button
            data-testid="change-button"
            onclick={() => send({ type: 'CHANGE' })}
          />
        </div>
      );
    };

    render(() => <App />);
    const result = screen.getByTestId('result');

    expect(result.textContent).toBe('1');

    fireEvent.click(screen.getByTestId('change-button'));

    expect(result.textContent).toBe('2');
  });

  it('should not miss initial synchronous updates', () => {
    const m = createMachine({
      types: {} as {
        context: { count: number };
      },
      initial: 'idle',
      context: {
        count: 0
      },
      entry: [assign({ count: 1 }), raise({ type: 'INC' })],
      on: {
        INC: {
          actions: [
            assign({ count: ({ context }) => ++context.count }),
            raise({ type: 'UNHANDLED' })
          ]
        }
      },
      states: {
        idle: {}
      }
    });

    const App = () => {
      const [state] = useMachine(m);
      return <div data-testid="sync-count">{state.context.count}</div>;
    };

    render(() => <App />);
    const countEl = screen.getByTestId('sync-count');
    expect(countEl.textContent).toBe('2');
  });

  it('should not use stale data in a guard', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EV: {
              guard: 'isAwesome',
              target: 'b'
            }
          }
        },
        b: {}
      }
    });
    const [isAwesome, setIsAwesome] = createSignal(false);
    const App = () => {
      const [state, send] = useMachine(machine, {
        guards: {
          isAwesome: () => isAwesome()
        }
      });
      return (
        <div>
          <div data-testid="result">{state.value.toString()}</div>
          <button onclick={() => send({ type: 'EV' })} />
        </div>
      );
    };

    render(() => <App />);
    setIsAwesome(true);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(screen.getByTestId('result').textContent).toBe('b');
  });

  it('referenced object in context should not update both machines', () => {
    const latestValue = { value: 100 };
    interface Context {
      latestValue: { value: number };
    }
    const machine = createMachine({
      types: {} as {
        context: Context;
        events: { type: 'INC' };
      },
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
                  latestValue: ({ context }) => ({
                    value: context.latestValue.value + 1
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
      onCleanup(() => {
        expect(service.getSnapshot().status).toBe('stopped');
        done();
      });
      const [state, , service] = useMachine(machine);
      return <div>{state.toString()}</div>;
    };
    const Counter = () => {
      const [show, setShow] = createSignal(true);
      setTimeout(() => setShow(false), 100);

      return <div>{show() ? <Display /> : null}</div>;
    };

    render(() => <Counter />);
    jest.advanceTimersByTime(200);
  });

  it('.can should trigger on context change', () => {
    const machine = createMachine(
      {
        initial: 'a',
        context: {
          isAwesome: false,
          isNotAwesome: true
        },
        states: {
          a: {
            on: {
              TOGGLE: {
                actions: 'toggleIsAwesome'
              },
              TOGGLE_NOT: {
                actions: 'toggleIsNotAwesome'
              },
              EV: {
                guard: 'isAwesome',
                target: 'b'
              }
            }
          },
          b: {}
        }
      },
      {
        actions: {
          toggleIsAwesome: assign(({ context }) => ({
            isAwesome: !context.isAwesome
          })),
          toggleIsNotAwesome: assign(({ context }) => ({
            isNotAwesome: !context.isNotAwesome
          }))
        },
        guards: {
          isAwesome: ({ context }) => !!context.isAwesome
        }
      }
    );

    let count = 0;

    const App = () => {
      const [state, send] = useMachine(machine);
      createEffect(() => {
        count += 1;
        state.can({ type: 'EV' });
      });
      return (
        <div>
          <button
            data-testid="toggle-button"
            onClick={() => send({ type: 'TOGGLE' })}
          >
            Toggle
          </button>
          <button
            data-testid="toggle-not-button"
            onClick={() => send({ type: 'TOGGLE_NOT' })}
          >
            Toggle NOT
          </button>
          <Show keyed={false} when={state.can({ type: 'EV' })}>
            <div data-testid="can-send-ev"></div>
          </Show>
        </div>
      );
    };

    render(() => <App />);

    const toggleButton = screen.getByTestId('toggle-button');
    const toggleNotButton = screen.getByTestId('toggle-not-button');
    expect(count).toEqual(1);
    toggleNotButton.click();
    expect(screen.queryByTestId('can-send-ev')).not.toBeTruthy();
    expect(count).toEqual(1);
    toggleNotButton.click();
    expect(screen.queryByTestId('can-send-ev')).not.toBeTruthy();
    expect(count).toEqual(1);
    toggleButton.click();
    expect(screen.queryByTestId('can-send-ev')).toBeTruthy();
    expect(count).toEqual(2);
    toggleButton.click();
    expect(count).toEqual(3);
    toggleNotButton.click();
    expect(count).toEqual(3);
  });
});

describe('useMachine (strict mode)', () => {
  it('should not invoke initial services more than once', () => {
    let activatedCount = 0;
    const machine = createMachine({
      initial: 'active',
      invoke: {
        src: fromCallback(() => {
          activatedCount++;
          return () => {
            // noop
          };
        })
      },
      states: {
        active: {}
      }
    });

    const Test = () => {
      useMachine(machine);

      return null;
    };

    render(() => <Test />);

    expect(activatedCount).toEqual(1);
  });

  it('child component should be able to send an event to a parent immediately in an effect', (done) => {
    const machine = createMachine({
      types: {} as {
        events: { type: 'FINISH' };
      },
      initial: 'active',
      states: {
        active: {
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest = (props: { send: any }) => {
      // This will send an event to the parent service
      // BEFORE the service is ready.
      onMount(() => {
        props.send({ type: 'FINISH' });
      });

      return null;
    };

    const Test = () => {
      const [state, send] = useMachine(machine);
      createEffect(() => {
        if (state.matches('success')) {
          done();
        }
      });
      return <ChildTest send={send} />;
    };

    render(() => <Test />);
  });

  it('custom data should be available right away for the invoked actor', () => {
    const childMachine = createMachine({
      initial: 'initial',
      context: ({ input }: { input: { value: number } }) => ({
        value: input.value
      }),
      states: {
        initial: {}
      }
    });

    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'test',
            src: childMachine,
            input: { value: 42 }
          }
        }
      }
    });

    const Test = () => {
      const [state] = useMachine(machine);
      const [childState] = useActor(() => state.children.test);

      expect(childState().context.value).toBe(42);

      return null;
    };

    render(() => <Test />);
  });

  // https://github.com/davidkpiano/xstate/issues/1334
  it('delayed transitions should work when initializing from a rehydrated state', () => {
    jest.useFakeTimers();
    try {
      const testMachine = createMachine({
        types: {} as {
          events: { type: 'START' };
        },
        id: 'app',
        initial: 'idle',
        states: {
          idle: {
            on: {
              START: 'doingStuff'
            }
          },
          doingStuff: {
            id: 'doingStuff',
            after: {
              100: 'idle'
            }
          }
        }
      });

      const actorRef = createActor(testMachine).start();
      const persistedState = JSON.stringify(actorRef.getPersistedSnapshot());
      actorRef.stop();

      const Test = () => {
        const [state, send] = useMachine(testMachine, {
          snapshot: JSON.parse(persistedState)
        });

        return (
          <>
            <button
              onclick={() => send({ type: 'START' })}
              data-testid="button"
            />
            {state.value}
          </>
        );
      };

      const { container } = render(() => <Test />);

      const button = screen.getByTestId('button');

      fireEvent.click(button);
      jest.advanceTimersByTime(110);

      expect(container.textContent).toBe('idle');
    } finally {
      jest.useRealTimers();
    }
  });
});
