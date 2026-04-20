import { act, fireEvent, screen } from '@testing-library/react';
import { setTimeout as sleep } from 'node:timers/promises';
import * as React from 'react';
import { useState } from 'react';
import { BehaviorSubject } from 'rxjs';
import {
  Actor,
  ActorLogicFrom,
  ActorRef,
  DoneActorEvent,
  Snapshot,
  StateFrom,
  assign,
  createActor,
  createMachine,
  raise,
  setup
} from 'xstate';
import { fromCallback, fromObservable, fromPromise } from 'xstate/actors';
import { useActor, useSelector } from '../src/index.ts';
import { describeEachReactMode } from './utils.tsx';

afterEach(() => {
  vi.useRealTimers();
});

describeEachReactMode('useActor (%s)', ({ suiteKey, render }) => {
  const context = {
    data: undefined as undefined | string
  };
  const fetchMachine = createMachine({
    id: 'fetch',
    types: {} as {
      context: typeof context;
      events: { type: 'FETCH' } | DoneActorEvent;
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
              data: ({ event }) => {
                return event.output;
              }
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

  const persistedSuccessFetchState = actorRef.getPersistedSnapshot();

  const Fetcher: React.FC<{
    onFetch: () => Promise<any>;
    persistedState?: Snapshot<unknown>;
  }> = ({
    onFetch = () => {
      return new Promise((res) => res('some data'));
    },
    persistedState
  }) => {
    const [current, send] = useActor(
      fetchMachine.provide({
        actors: {
          fetchData: fromPromise(onFetch)
        }
      }),
      {
        snapshot: persistedState
      }
    );

    switch (current.value) {
      case 'idle':
        return <button onClick={(_) => send({ type: 'FETCH' })}>Fetch</button>;
      case 'loading':
        return <div>Loading...</div>;
      case 'success':
        return (
          <div>
            Success! Data: <div data-testid="data">{current.context.data}</div>
          </div>
        );
      default:
        return null;
    }
  };

  it('should work with the useActor hook', async () => {
    render(<Fetcher onFetch={() => new Promise((res) => res('fake data'))} />);
    const button = screen.getByText('Fetch');
    fireEvent.click(button);
    screen.getByText('Loading...');
    await screen.findByText(/Success/);
    const dataEl = screen.getByTestId('data');
    expect(dataEl.textContent).toBe('fake data');
  });

  it('should work with the useActor hook (rehydrated state)', async () => {
    render(
      <Fetcher
        onFetch={() => new Promise((res) => res('fake data'))}
        persistedState={persistedSuccessFetchState}
      />
    );

    await screen.findByText(/Success/);
    const dataEl = screen.getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should work with the useMachine hook (rehydrated state config)', async () => {
    const persistedFetchStateConfig = JSON.parse(
      JSON.stringify(persistedSuccessFetchState)
    );
    render(
      <Fetcher
        onFetch={() => new Promise((res) => res('fake data'))}
        persistedState={persistedFetchStateConfig}
      />
    );

    await screen.findByText(/Success/);
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

    render(<Test />);
  });

  it('should accept input and provide it to the context factory', () => {
    const testMachine = createMachine({
      types: {} as {
        context: { foo: string; test: boolean };
        input: { test: boolean };
      },
      context: ({ input }) => ({
        foo: 'bar',
        test: input.test ?? false
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

    render(<Test />);
  });

  it('should not spawn actors until service is started', async () => {
    const spawnMachine = createMachine({
      types: {} as { context: { ref?: ActorRef<any, any> } },
      id: 'spawn',
      initial: 'start',
      context: { ref: undefined },
      states: {
        start: {
          entry: assign({
            ref: ({ spawn }) =>
              spawn(
                fromPromise(() => {
                  return new Promise((res) => res(42));
                }),
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

      switch (current.value) {
        case 'start':
          return <span data-testid="start" />;
        case 'success':
          return <span data-testid="success" />;
        default:
          return null;
      }
    };

    render(<Spawner />);

    await screen.findByTestId('success');
  });

  it('actions should not use stale data in a builtin transition action', () => {
    const { resolve, promise } = Promise.withResolvers<void>();

    const toggleMachine = createMachine({
      types: {} as {
        context: { latest: number };
        events: { type: 'SET_LATEST' };
      },
      context: {
        latest: 0
      },
      on: {
        SET_LATEST: {
          actions: 'setLatest'
        }
      }
    });

    const Component = () => {
      const [ext, setExt] = useState(1);

      const [, send] = useActor(
        toggleMachine.provide({
          actions: {
            setLatest: assign({
              latest: () => {
                expect(ext).toBe(2);
                resolve();
                return ext;
              }
            })
          }
        })
      );

      return (
        <>
          <button
            data-testid="extbutton"
            onClick={(_) => {
              setExt(2);
            }}
          />
          <button
            data-testid="button"
            onClick={(_) => {
              send({ type: 'SET_LATEST' });
            }}
          />
        </>
      );
    };

    render(<Component />);

    const button = screen.getByTestId('button');
    const extButton = screen.getByTestId('extbutton');
    fireEvent.click(extButton);

    fireEvent.click(button);

    return promise;
  });

  it('actions should not use stale data in a builtin entry action', () => {
    const { resolve, promise } = Promise.withResolvers<void>();

    const toggleMachine = createMachine({
      types: {} as { context: { latest: number }; events: { type: 'NEXT' } },
      context: {
        latest: 0
      },
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: 'setLatest'
        }
      }
    });

    const Component = () => {
      const [ext, setExt] = useState(1);

      const [, send] = useActor(
        toggleMachine.provide({
          actions: {
            setLatest: assign({
              latest: () => {
                expect(ext).toBe(2);
                resolve();
                return ext;
              }
            })
          }
        })
      );

      return (
        <>
          <button
            data-testid="extbutton"
            onClick={(_) => {
              setExt(2);
            }}
          />
          <button
            data-testid="button"
            onClick={(_) => {
              send({ type: 'NEXT' });
            }}
          />
        </>
      );
    };

    render(<Component />);

    const button = screen.getByTestId('button');
    const extButton = screen.getByTestId('extbutton');
    fireEvent.click(extButton);

    fireEvent.click(button);

    return promise;
  });

  it('actions should not use stale data in a custom entry action', () => {
    const { resolve, promise } = Promise.withResolvers<void>();

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
      const [ext, setExt] = useState(false);

      const doAction = React.useCallback(() => {
        expect(ext).toBeTruthy();
        resolve();
      }, [ext]);

      const [, send] = useActor(
        toggleMachine.provide({
          actions: {
            doAction
          }
        })
      );

      return (
        <>
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
        </>
      );
    };

    render(<Toggle />);

    const button = screen.getByTestId('button');
    const extButton = screen.getByTestId('extbutton');
    fireEvent.click(extButton);

    fireEvent.click(button);

    return promise;
  });

  it('should only render once when initial microsteps are involved', () => {
    let rerenders = 0;

    const m = createMachine(
      {
        types: {} as { context: { stuff: number[] } },
        initial: 'init',
        context: { stuff: [1, 2, 3] },
        states: {
          init: {
            entry: 'setup',
            always: 'ready'
          },
          ready: {}
        }
      },
      {
        actions: {
          setup: assign({
            stuff: ({ context }) => [...context.stuff, 4]
          })
        }
      }
    );

    const App = () => {
      useActor(m);
      rerenders++;
      return null;
    };

    render(<App />);

    expect(rerenders).toBe(suiteKey === 'strict' ? 2 : 1);
  });

  it('should maintain the same reference for objects created when resolving initial state', () => {
    let effectsFired = 0;

    const m = createMachine(
      {
        types: {} as { context: { counter: number; stuff: number[] } },
        initial: 'init',
        context: { counter: 0, stuff: [1, 2, 3] },
        states: {
          init: {
            entry: 'setup'
          }
        },
        on: {
          INC: {
            actions: 'increase'
          }
        }
      },
      {
        actions: {
          setup: assign({
            stuff: ({ context }) => [...context.stuff, 4]
          }),
          increase: assign({
            counter: ({ context }) => ++context.counter
          })
        }
      }
    );

    const App = () => {
      const [state, send] = useActor(m);

      // this effect should only fire once since `stuff` never changes
      React.useEffect(() => {
        effectsFired++;
      }, [state.context.stuff]);

      return (
        <>
          <div>{`Counter: ${state.context.counter}`}</div>
          <button onClick={() => send({ type: 'INC' })}>Increase</button>
        </>
      );
    };

    const { getByRole } = render(<App />);

    expect(effectsFired).toBe(suiteKey === 'strict' ? 2 : 1);

    const button = getByRole('button');
    fireEvent.click(button);

    expect(effectsFired).toBe(suiteKey === 'strict' ? 2 : 1);
  });

  it('should successfully spawn actors from the lazily declared context', () => {
    let childSpawned = false;

    const machine = createMachine({
      context: ({ spawn }) => ({
        ref: spawn(
          fromCallback(() => {
            childSpawned = true;
          })
        )
      })
    });

    const App = () => {
      useActor(machine);
      return null;
    };

    render(<App />);

    expect(childSpawned).toBe(true);
  });

  it('should be able to use an action provided outside of React', () => {
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
      const [_state, send] = useActor(machine);
      React.useEffect(() => {
        send({ type: 'EV' });
      }, []);
      return null;
    };

    render(<App />);

    expect(actionCalled).toBe(true);
  });

  it('should be able to use a guard provided outside of React', () => {
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
      React.useEffect(() => {
        send({ type: 'EV' });
      }, []);
      return null;
    };

    render(<App />);

    expect(guardCalled).toBe(true);
  });

  it('should be able to use a service provided outside of React', () => {
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
      const [_state, send] = useActor(machine);
      React.useEffect(() => {
        send({ type: 'EV' });
      }, []);
      return null;
    };

    render(<App />);

    expect(serviceCalled).toBe(true);
  });

  it('should be able to use a delay provided outside of React', () => {
    vi.useFakeTimers();

    const machine = setup({
      delays: {
        myDelay: () => {
          return 300;
        }
      }
    }).createMachine({
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
    });

    const App = () => {
      const [state, send] = useActor(machine);
      return (
        <>
          <div data-testid="result">{state.value}</div>
          <button onClick={() => send({ type: 'EV' })} />
        </>
      );
    };

    render(<App />);

    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(screen.getByTestId('result').textContent).toBe('b');

    act(() => {
      vi.advanceTimersByTime(310);
    });

    expect(screen.getByTestId('result').textContent).toBe('c');
  });

  it('should not use stale data in a guard', () => {
    const machine = setup({
      guards: {
        isAwesome: () => false
      }
    }).createMachine({
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

    const App = ({ isAwesome }: { isAwesome: boolean }) => {
      const [state, send] = useActor(
        machine.provide({
          guards: {
            isAwesome: () => isAwesome
          }
        })
      );
      return (
        <>
          <div data-testid="result">{state.value}</div>
          <button onClick={() => send({ type: 'EV' })} />
        </>
      );
    };

    const { rerender } = render(<App isAwesome={false} />);
    rerender(<App isAwesome={true} />);

    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(screen.getByTestId('result').textContent).toBe('b');
  });

  it('should not invoke initial services more than once', () => {
    let activatedCount = 0;
    const machine = createMachine({
      initial: 'active',
      invoke: {
        src: fromCallback(() => {
          activatedCount++;
          return () => {
            /* empty */
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

    render(<Test />);

    expect(activatedCount).toEqual(suiteKey === 'strict' ? 2 : 1);
  });

  it('child component should be able to send an event to a parent immediately in an effect', () => {
    const machine = setup({}).createMachine({
      types: {} as {
        events: {
          type: 'FINISH';
        };
      },
      initial: 'active',
      states: {
        active: {
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest: React.FC<{ send: any }> = ({ send }) => {
      // This will send an event to the parent service
      // BEFORE the service is ready.
      React.useLayoutEffect(() => {
        send({ type: 'FINISH' });
      }, []);

      return null;
    };

    const Test = () => {
      const [state, send] = useActor(machine);

      return (
        <>
          <ChildTest send={send} />
          {state.value}
        </>
      );
    };

    const { container } = render(<Test />);

    expect(container.textContent).toBe('success');
  });

  it('custom data should be available right away for the invoked actor', () => {
    const childMachine = createMachine({
      types: {
        context: {} as { value: number }
      },
      initial: 'initial',
      context: ({ input }: { input: { value: number } }) => {
        return {
          value: input.value
        };
      },
      states: {
        initial: {}
      }
    });

    const machine = createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof childMachine;
            id: 'test';
          };
        },
        initial: 'active',
        states: {
          active: {
            invoke: {
              src: 'child',
              id: 'test',
              input: { value: 42 }
            }
          }
        }
      },
      {
        actors: { child: childMachine }
      }
    );

    const Test = () => {
      const [state] = useActor(machine);
      const childState = useSelector(state.children.test!, (s) => s);

      expect(childState.context.value).toBe(42);

      return null;
    };

    render(<Test />);
  });

  // https://github.com/statelyai/xstate/issues/1334
  it('delayed transitions should work when initializing from a rehydrated state', () => {
    vi.useFakeTimers();
    const testMachine = createMachine({
      types: {} as {
        events: {
          type: 'START';
        };
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

    let currentState: StateFrom<typeof testMachine>;

    const Test = () => {
      const [state, send] = useActor(testMachine, {
        snapshot: JSON.parse(persistedState)
      });

      currentState = state;

      return (
        <button
          onClick={() => send({ type: 'START' })}
          data-testid="button"
        ></button>
      );
    };

    render(<Test />);

    const button = screen.getByTestId('button');

    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(110);
    });

    expect(currentState!.matches('idle')).toBe(true);
  });

  it('should not miss initial synchronous updates', () => {
    const m = createMachine({
      types: {} as { context: { count: number } },
      initial: 'idle',
      context: {
        count: 0
      },
      entry: [assign({ count: 1 }), raise({ type: 'INC' })],
      on: {
        INC: {
          actions: [
            assign({ count: ({ context }) => context.count + 1 }),
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
      return <>{state.context.count}</>;
    };

    const { container } = render(<App />);

    expect(container.textContent).toBe('2');
  });

  it('should deliver messages sent from an effect to an actor registered in the system', () => {
    const spy = vi.fn();
    const m = createMachine({
      invoke: {
        systemId: 'child',
        src: createMachine({
          on: {
            PING: {
              actions: spy
            }
          }
        })
      }
    });

    const App = () => {
      const [_state, _send, actor] = useActor(m);

      React.useEffect(() => {
        actor.system.get('child')!.send({ type: 'PING' });
      });

      return null;
    };

    render(<App />);

    expect(spy).toHaveBeenCalledTimes(suiteKey === 'strict' ? 2 : 1);
  });

  it('should work with `onSnapshot`', () => {
    const subject = new BehaviorSubject(0);

    const spy = vi.fn();

    const machine = createMachine({
      invoke: [
        {
          src: fromObservable(() => subject),
          onSnapshot: {
            actions: [({ event }) => spy((event.snapshot as any).context)]
          }
        }
      ]
    });

    const App = () => {
      useActor(machine);
      return null;
    };

    render(<App />);

    spy.mockClear();

    subject.next(42);
    subject.next(100);

    expect(spy.mock.calls).toEqual([[42], [100]]);
  });

  it('should execute a delayed transition of the initial state', async () => {
    const machine = setup({}).createMachine({
      initial: 'one',
      states: {
        one: {
          after: {
            10: 'two'
          }
        },
        two: {}
      }
    });

    const App = () => {
      const [state] = useActor(machine);
      return <>{state.value}</>;
    };

    const { container } = render(<App />);

    expect(container.textContent).toBe('one');

    await act(async () => {
      await sleep(10);
    });

    expect(container.textContent).toBe('two');
  });

  it('should throw an error to an error boundary when the actor reaches an error state', async () => {
    const errorMessage = 'test_useActor_error';

    const machine = createMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: fromPromise(() => Promise.reject(new Error(errorMessage)))
          }
        }
      }
    });

    class ErrorBoundary extends React.Component<
      { children: React.ReactNode },
      { error: Error | null }
    > {
      state = { error: null as Error | null };
      static getDerivedStateFromError(error: Error) {
        return { error };
      }
      render() {
        if (this.state.error) {
          return <div data-testid="error">{this.state.error.message}</div>;
        }
        return this.props.children;
      }
    }

    const App = () => {
      const [state] = useActor(machine);
      return <div data-testid="value">{String(state.value)}</div>;
    };

    console.error = vi.fn();

    render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );

    await screen.findByTestId('error');
    expect(screen.getByTestId('error').textContent).toBe(errorMessage);
  });
});
