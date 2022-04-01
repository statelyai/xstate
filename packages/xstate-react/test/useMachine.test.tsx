import { act, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { useState } from 'react';
import {
  AnyState,
  assign,
  createMachine,
  DoneEventObject,
  doneInvoke,
  Interpreter,
  InterpreterFrom,
  Machine,
  send,
  spawn,
  State
} from 'xstate';
import { useActor, useMachine } from '../src';
import { describeEachReactMode } from './utils';

afterEach(() => {
  jest.useRealTimers();
});

describeEachReactMode('useMachine (%s)', ({ suiteKey, render }) => {
  const context = {
    data: undefined
  };
  const fetchMachine = Machine<
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
            cond: (_, e) => e.data.length
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  const persistedFetchState = fetchMachine.transition(
    'loading',
    doneInvoke('fetchData', 'persisted data')
  );

  const Fetcher: React.FC<{
    onFetch: () => Promise<any>;
    persistedState?: AnyState;
  }> = ({
    onFetch = () => new Promise((res) => res('some data')),
    persistedState
  }) => {
    const [current, send] = useMachine(fetchMachine, {
      services: {
        fetchData: onFetch
      },
      state: persistedState
    });

    switch (current.value) {
      case 'idle':
        return <button onClick={(_) => send('FETCH')}>Fetch</button>;
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
        persistedState={persistedFetchState}
      />
    );

    await screen.findByText(/Success/);
    const dataEl = screen.getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should work with the useMachine hook (rehydrated state config)', async () => {
    const persistedFetchStateConfig = JSON.parse(
      JSON.stringify(persistedFetchState)
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
    const testMachine = Machine<{ foo: string; test: boolean }>({
      context: {
        foo: 'bar',
        test: false
      },
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    const Test = () => {
      const [state] = useMachine(testMachine, { context: { test: true } });

      expect(state.context).toEqual({
        foo: 'bar',
        test: true
      });

      return null;
    };

    render(<Test />);
  });

  it('should not spawn actors until service is started', async (done) => {
    const spawnMachine = Machine<any>({
      id: 'spawn',
      initial: 'start',
      context: { ref: undefined },
      states: {
        start: {
          entry: assign({
            ref: () => spawn(() => new Promise((res) => res(42)), 'my-promise')
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
    done();
  });

  it('actions should not have stale data', async (done) => {
    const toggleMachine = Machine<any, { type: 'TOGGLE' }>({
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
              send('TOGGLE');
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

    type TestState =
      | {
          value: 'loading';
          context: { count: number; user: undefined };
        }
      | {
          value: 'loaded';
          context: { user: { name: string } };
        };

    const machine = createMachine<TestContext, any, TestState>({
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
      service: InterpreterFrom<typeof machine>;
    }> = ({ service }) => {
      const [state] = useActor(service);

      if (state.matches('loaded')) {
        const name = state.context.user.name;

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
        const name = state.context.user.name;

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

  it('should successfully spawn actors from the lazily declared context', () => {
    let childSpawned = false;

    const machine = createMachine({
      context: () => ({
        ref: spawn(() => {
          childSpawned = true;
        })
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
                cond: 'isAwesome',
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
        services: {
          foo: () => {
            serviceCalled = true;
            return Promise.resolve();
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
              cond: 'isAwesome',
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
        src: () => {
          activatedCount++;
          return () => {};
        }
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

  it('child component should be able to send an event to a parent immediately in an effect', (done) => {
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

      if (state.matches('success')) {
        done();
      }

      return <ChildTest send={send} />;
    };

    render(<Test />);
  });

  it('custom data should be available right away for the invoked actor', () => {
    const childMachine = Machine({
      initial: 'intitial',
      context: {
        value: 100
      },
      states: {
        intitial: {}
      }
    });

    const machine = Machine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'test',
            src: childMachine,
            data: {
              value: () => 42
            }
          }
        }
      }
    });

    const Test = () => {
      const [state] = useMachine(machine);
      const [childState] = useActor(state.children.test);

      expect(childState.context.value).toBe(42);

      return null;
    };

    render(<Test />);
  });

  // https://github.com/statelyai/xstate/issues/1334
  it('delayed transitions should work when initializing from a rehydrated state', () => {
    jest.useFakeTimers();
    const testMachine = Machine<any, { type: 'START' }>({
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

    let currentState: State<any, any, any, any, any>;

    const Test = () => {
      const [state, send] = useMachine(testMachine, {
        state: State.create(JSON.parse(persistedState))
      });

      currentState = state;

      return (
        <button onClick={() => send('START')} data-testid="button"></button>
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
      entry: [assign({ count: 1 }), send('INC')],
      on: {
        INC: {
          actions: [assign({ count: (ctx) => ++ctx.count }), send('UNHANDLED')]
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
