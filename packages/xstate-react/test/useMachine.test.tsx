import { act, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { useState } from 'react';
import {
  ActorRef,
  ActorRefFrom,
  assign,
  createMachine,
  DoneEventObject,
  doneInvoke,
  Interpreter,
  PersistedMachineState,
  send,
  StateFrom
} from 'xstate';
import { fromCallback, fromPromise } from 'xstate/actors';
import { useActor, useMachine } from '../src/index.js';
import { describeEachReactMode } from './utils';

afterEach(() => {
  jest.useRealTimers();
});

describeEachReactMode('useMachine (%s)', ({ suiteKey, render }) => {
  const context = {
    data: undefined
  };
  const fetchMachine = createMachine<
    typeof context,
    { type: 'FETCH' } | DoneEventObject
  >({
    id: 'fetch',
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
              data: (_, e) => e.data
            }),
            guard: (_, e) => e.data.length
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  const successFetchState = fetchMachine.transition('loading', {
    type: 'done.invoke.fetchData',
    data: 'persisted data'
  });

  const persistedSuccessFetchState = fetchMachine.getPersistedState(
    successFetchState
  );

  const Fetcher: React.FC<{
    onFetch: () => Promise<any>;
    persistedState?: PersistedMachineState<any>;
  }> = ({
    onFetch = () => {
      return new Promise((res) => res('some data'));
    },
    persistedState
  }) => {
    const [current, send] = useMachine(fetchMachine, {
      state: persistedState,
      actors: {
        fetchData: fromPromise(onFetch)
      }
    });

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

  it('should work with the useMachine hook', async () => {
    render(<Fetcher onFetch={() => new Promise((res) => res('fake data'))} />);
    const button = screen.getByText('Fetch');
    fireEvent.click(button);
    screen.getByText('Loading...');
    await screen.findByText(/Success/);
    const dataEl = screen.getByTestId('data');
    expect(dataEl.textContent).toBe('fake data');
  });

  it('should work with the useMachine hook (rehydrated state)', async () => {
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
      const [, , service] = useMachine(fetchMachine);

      if (!(service instanceof Interpreter)) {
        throw new Error('service not instance of Interpreter');
      }

      return null;
    };

    render(<Test />);
  });

  it('should provide options for the service', () => {
    const Test = () => {
      const [, , service] = useMachine(fetchMachine, {
        execute: false
      });

      expect(service.options.execute).toBe(false);

      return null;
    };

    render(<Test />);
  });

  it('should merge machine context with options.context', () => {
    const testMachine = createMachine<{ foo: string; test: boolean }>({
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
      const [state] = useMachine(testMachine, {
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
    const spawnMachine = createMachine<{ ref?: ActorRef<any> }>({
      id: 'spawn',
      initial: 'start',
      context: { ref: undefined },
      states: {
        start: {
          entry: assign({
            ref: (_, __, { spawn }) =>
              spawn(
                fromPromise(() => {
                  return new Promise((res) => res(42));
                }),
                'my-promise'
              )
          }),
          on: {
            [doneInvoke('my-promise')]: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const Spawner = () => {
      const [current] = useMachine(spawnMachine);

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

  it('actions should not use stale data in a builtin transition action', (done) => {
    const toggleMachine = createMachine<any, { type: 'SET_LATEST' }>({
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

      const [, send] = useMachine(toggleMachine, {
        actions: {
          setLatest: assign({
            latest: () => {
              expect(ext).toBe(2);
              done();
              return ext;
            }
          })
        }
      });

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
  });

  it('actions should not use stale data in a builtin entry action', (done) => {
    const toggleMachine = createMachine<any, { type: 'NEXT' }>({
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

      const [, send] = useMachine(toggleMachine, {
        actions: {
          setLatest: assign({
            latest: () => {
              expect(ext).toBe(2);
              done();
              return ext;
            }
          })
        }
      });

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
  });

  it('actions should not use stale data in a custom entry action', (done) => {
    const toggleMachine = createMachine<any, { type: 'TOGGLE' }>({
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
        done();
      }, [ext]);

      const [, send] = useMachine(toggleMachine, {
        actions: {
          doAction
        }
      });

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
  });

  it('should compile with typed matches (createMachine)', () => {
    interface TestContext {
      count?: number;
      user?: { name: string };
    }

    const machine = createMachine<TestContext, any>({
      initial: 'loading',
      states: {
        loading: {
          initial: 'one',
          states: {
            one: {},
            two: {}
          }
        },
        loaded: {}
      }
    });

    const ServiceApp: React.FC<{
      service: ActorRefFrom<typeof machine>;
    }> = ({ service }) => {
      const [state] = useActor(service);

      if (state.matches('loaded')) {
        const name = state.context.user!.name;

        // never called - it's okay if the name is undefined
        expect(name).toBeTruthy();
      } else if (state.matches('loading')) {
        // Make sure state isn't "never" - if it is, tests will fail to compile
        expect(state).toBeTruthy();
      }

      return null;
    };

    const App = () => {
      const [state, , service] = useMachine(machine);

      if (state.matches('loaded')) {
        const name = state.context.user!.name;

        // never called - it's okay if the name is undefined
        expect(name).toBeTruthy();
      } else if (state.matches('loading')) {
        // Make sure state isn't "never" - if it is, tests will fail to compile
        expect(state).toBeTruthy();
      }

      return <ServiceApp service={service} />;
    };

    // Just testing that it compiles
    render(<App />);
  });

  it('should only render once when initial microsteps are involved', () => {
    let rerenders = 0;

    const m = createMachine<{ stuff: number[] }>(
      {
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
            stuff: (context: any) => [...context.stuff, 4]
          })
        }
      }
    );

    const App = () => {
      useMachine(m);
      rerenders++;
      return null;
    };

    render(<App />);

    expect(rerenders).toBe(
      suiteKey === 'strict'
        ? // it's rendered twice for the each state
          // and the machine gets currently completely restarted in a double-invoked strict effect
          // so we get a new state from that restarted machine (and thus 2 additional strict renders) and we end up with 4
          4
        : 1
    );
  });

  it('should maintain the same reference for objects created when resolving initial state', () => {
    let effectsFired = 0;

    const m = createMachine<{ counter: number; stuff: number[] }>(
      {
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
            stuff: (context: any) => [...context.stuff, 4]
          }),
          increase: assign({
            counter: (context: any) => ++context.counter
          })
        }
      }
    );

    const App = () => {
      const [state, send] = useMachine(m);

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

    expect(effectsFired).toBe(
      suiteKey === 'strict'
        ? // TODO: probably it should be 2 for strict mode cause of the double-invoked strict effects
          // atm it's 3 cause we the double-invoked effect sees the initial value
          // but the 3rd call comes from the restarted machine (that happens because of the strict effects)
          // the second effect with `service.start()` doesn't have a way to change what another effect in the same "effect batch" sees
          3
        : 1
    );

    const button = getByRole('button');
    fireEvent.click(button);

    expect(effectsFired).toBe(suiteKey === 'strict' ? 3 : 1);
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
      useMachine(machine);
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
      const [_state, send] = useMachine(machine);
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
      const [_state, send] = useMachine(machine);
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
          foo: () =>
            fromPromise(() => {
              serviceCalled = true;
              return Promise.resolve();
            })
        }
      }
    );

    const App = () => {
      const [_state, send] = useMachine(machine);
      React.useEffect(() => {
        send({ type: 'EV' });
      }, []);
      return null;
    };

    render(<App />);

    expect(serviceCalled).toBe(true);
  });

  it('should be able to use a delay provided outside of React', () => {
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
      jest.advanceTimersByTime(310);
    });

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

    const App = ({ isAwesome }: { isAwesome: boolean }) => {
      const [state, send] = useMachine(machine, {
        guards: {
          isAwesome: () => isAwesome
        }
      });
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
        src: () =>
          fromCallback(() => {
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
      useMachine(machine);

      return null;
    };

    render(<Test />);

    expect(activatedCount).toEqual(suiteKey === 'strict' ? 2 : 1);
  });

  it('child component should be able to send an event to a parent immediately in an effect', () => {
    const machine = createMachine<any, { type: 'FINISH' }>({
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
      const [state, send] = useMachine(machine);

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
      initial: 'intitial',
      context: {
        value: 100
      },
      states: {
        intitial: {}
      }
    });

    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'test',
            src: childMachine.withContext({ value: 42 })
          }
        }
      }
    });

    const Test = () => {
      const [state] = useMachine(machine);
      const [childState] = useActor(
        state.children.test as ActorRefFrom<typeof childMachine> // TODO: introduce typing for this in machine schema
      );

      expect(childState.context.value).toBe(42);

      return null;
    };

    render(<Test />);
  });

  // https://github.com/statelyai/xstate/issues/1334
  it('delayed transitions should work when initializing from a rehydrated state', () => {
    jest.useFakeTimers();
    const testMachine = createMachine<any, { type: 'START' }>({
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

    const persistedState = JSON.stringify(testMachine.initialState);

    let currentState: StateFrom<typeof testMachine>;

    const Test = () => {
      const [state, send] = useMachine(testMachine, {
        state: testMachine.createState(JSON.parse(persistedState))
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
      jest.advanceTimersByTime(110);
    });

    expect(currentState!.matches('idle')).toBe(true);
  });

  it('should accept a lazily created machine', () => {
    const App = () => {
      const [state] = useMachine(() =>
        createMachine({
          initial: 'idle',
          states: {
            idle: {}
          }
        })
      );

      expect(state.matches('idle')).toBeTruthy();

      return null;
    };

    render(<App />);
  });

  it('should not miss initial synchronous updates', () => {
    const m = createMachine<{ count: number }>({
      initial: 'idle',
      context: {
        count: 0
      },
      entry: [assign({ count: 1 }), send({ type: 'INC' })],
      on: {
        INC: {
          actions: [
            assign({ count: (ctx) => ctx.count + 1 }),
            send({ type: 'UNHANDLED' })
          ]
        }
      },
      states: {
        idle: {}
      }
    });

    const App = () => {
      const [state] = useMachine(m);
      return <>{state.context.count}</>;
    };

    const { container } = render(<App />);

    expect(container.textContent).toBe('2');
  });
});
