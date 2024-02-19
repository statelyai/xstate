/* @jsxImportSource solid-js */
import {
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
  fromTransition,
  raise
} from 'xstate';
import { fromCallback, fromPromise } from 'xstate/actors';
import { useActor } from '../src';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => {
  jest.useRealTimers();
});

describe('useActor', () => {
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
    const [snapshot, send] = useActor(
      fetchMachine.provide({
        actors: {
          fetchData: fromPromise(mergedProps.onFetch)
        }
      }),
      {
        snapshot: mergedProps.persistedState
      }
    );

    return (
      <Switch fallback={null}>
        <Match when={snapshot.matches('idle')}>
          <button onclick={(_) => send({ type: 'FETCH' })}>Fetch</button>;
        </Match>
        <Match when={snapshot.matches('loading')}>
          <div>Loading...</div>
        </Match>
        <Match when={snapshot.matches('success')}>
          Success! Data: <div data-testid="data">{snapshot.context.data}</div>
        </Match>
      </Switch>
    );
  };

  it('should work (default initial snapshot)', async () => {
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

  it('should work (rehydrated state)', async () => {
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

  it('should work (rehydrated state config)', async () => {
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
      const [, , service] = useActor(fetchMachine);

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
      const [state] = useActor(testMachine, {
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
      const [current] = useActor(spawnMachine);

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
      const [current, send] = useActor(machine);

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

      const [, send] = useActor(
        toggleMachine.provide({
          actions: {
            doAction
          }
        })
      );

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
      const [state, send] = useActor(machine);
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
      const [state, send] = useActor(machine);
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

  it('useMachine array with odd number of items should be replaceable', () => {
    const machine = createMachine({
      types: {},
      initial: 'active',
      context: {
        numbersList: [1, 2, 3, 4, 5]
      },
      states: {
        active: {
          on: {
            REPLACE_ALL: {
              actions: [
                assign({
                  numbersList: [4, 3, 2, 1, 0]
                })
              ]
            }
          }
        }
      }
    });

    const App = () => {
      const [state, send] = useActor(machine);

      onMount(() => {
        expect(state.context.numbersList).toEqual([1, 2, 3, 4, 5]);
        send({ type: 'REPLACE_ALL' });
        expect(state.context.numbersList).toEqual([4, 3, 2, 1, 0]);
      });

      return (
        <div data-testid="numbers-list">
          {state.context.numbersList.join('')}
        </div>
      );
    };

    render(() => <App />);

    const numbersListEl = screen.getByTestId('numbers-list');

    // Effect should only trigger once for the COUNT events:
    expect(numbersListEl.textContent).toEqual('43210');
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
      const [state, send] = useActor(counterMachine2);
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
      const [state, send] = useActor(machine);
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
      useActor(machine);

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
      const [state, send] = useActor(machine);
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
      const [state, send] = useActor(machine);
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
      const [state, send] = useActor(machine);
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
      const [state, send] = useActor(machine);

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
      useActor(machine);
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
      const [, send] = useActor(machine);
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
      const [_state, send] = useActor(machine);
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
      const [, send] = useActor(machine);
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
      const [state, send] = useActor(machine);
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
      const [state, send] = useActor(
        machine.provide({
          guards: {
            isAwesome: () => props.isAwesome
          }
        })
      );
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
      const [state, send] = useActor(machine);

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
      const [state] = useActor(m);
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
      const [state, send] = useActor(
        machine.provide({
          guards: {
            isAwesome: () => isAwesome()
          }
        })
      );
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
      const [state1, send1] = useActor(machine);
      const [state2, send2] = useActor(machine);

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
      const [state, , service] = useActor(machine);
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
      const [state, send] = useActor(machine);
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
      useActor(machine);

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
      const [state, send] = useActor(machine);
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
      types: {} as {
        inpit: {
          value: number;
        };
        context: {
          value: number;
        };
      },
      initial: 'initial',
      context: ({ input }: { input: { value: number } }) => ({
        value: input.value
      }),
      states: {
        initial: {}
      }
    });

    const machine = createMachine({
      types: {} as {
        actors: { src: 'child'; logic: typeof childMachine; id: 'test' };
      },
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'test',
            src: 'child',
            input: { value: 42 }
          }
        }
      }
    });

    const Test = () => {
      const [snapshot] = useActor(machine);

      expect(snapshot.children.test?.getSnapshot().context.value).toBe(42);

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
        const [state, send] = useActor(testMachine, {
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

  it('should work with an after transition scheduled after scheduling and cancelling a delayed transition', async () => {
    const machine = createMachine({
      initial: 'NotHeld',
      states: {
        NotHeld: {
          initial: 'Idle',
          states: {
            Idle: { on: { increment: { target: 'RecentlyClicked' } } },
            RecentlyClicked: {
              on: { increment: { target: 'TripleClicked' } },
              after: { 40: 'Idle' }
            },
            TripleClicked: {
              on: { increment: { target: 'TripleClicked', reenter: true } },
              after: { 40: 'Idle' }
            }
          },
          on: { holdIncrement: 'Held.HeldIncrement' }
        },
        Held: {
          initial: 'HeldIncrement',
          states: { HeldIncrement: { after: { 40: 'HeldIncrement' } } },
          on: { releasePointer: 'NotHeld.Idle' }
        }
      }
    });

    const Test = () => {
      const [snapshot, send] = useActor(machine);

      return (
        <>
          <button
            onclick={() => send({ type: 'increment' })}
            data-testid="inc_button"
          />
          <button
            onclick={() => send({ type: 'holdIncrement', y: 0 })}
            data-testid="hold_inc_button"
          />
          <button
            onclick={() => send({ type: 'releasePointer' })}
            data-testid="release_button"
          />
          {JSON.stringify(snapshot.value)}
        </>
      );
    };

    const { container } = render(() => <Test />);

    const incrementButton = screen.getByTestId('inc_button');
    const holdIncrementButton = screen.getByTestId('hold_inc_button');
    const releasePointerButton = screen.getByTestId('release_button');

    await sleep(100);
    fireEvent.click(incrementButton);
    await sleep(10);
    fireEvent.click(incrementButton);
    await sleep(10);
    fireEvent.click(holdIncrementButton);
    await sleep(10);
    fireEvent.click(releasePointerButton);
    await sleep(10);
    fireEvent.click(incrementButton);
    await sleep(10);
    fireEvent.click(incrementButton);
    await sleep(50);

    expect(JSON.parse(container.textContent as string)).toEqual({
      NotHeld: 'Idle'
    });
  });

  it('should be able to work with `fromTransition`', () => {
    const reducer = (state: number, event: { type: 'INC' }): number => {
      if (event.type === 'INC') {
        return state + 1;
      }

      return state;
    };

    const Test = () => {
      const [count, send] = useActor(fromTransition(reducer, 0));

      return (
        <button data-testid="count" onclick={() => send({ type: 'INC' })}>
          {count.context}
        </button>
      );
    };

    render(() => <Test />);
    const button = screen.getByTestId('count');

    expect(button.textContent).toEqual('0');

    fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
