import * as React from 'react';
import { useMachine, useService } from '../src';
import {
  Machine,
  assign,
  Interpreter,
  spawn,
  doneInvoke,
  State,
  createMachine
} from 'xstate';
import {
  render,
  fireEvent,
  cleanup,
  waitForElement
} from '@testing-library/react';
import { useState } from 'react';

afterEach(cleanup);

describe('useMachine hook', () => {
  const context = {
    data: undefined
  };
  const fetchMachine = Machine<typeof context>({
    id: 'fetch',
    initial: 'idle',
    context,
    states: {
      idle: {
        on: { FETCH: 'loading' }
      },
      loading: {
        invoke: {
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
    persistedState?: State<any, any>;
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
    const { getByText, getByTestId } = render(
      <Fetcher onFetch={() => new Promise((res) => res('fake data'))} />
    );
    const button = getByText('Fetch');
    fireEvent.click(button);
    getByText('Loading...');
    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('fake data');
  });

  it('should work with the useMachine hook (rehydrated state)', async () => {
    const { getByText, getByTestId } = render(
      <Fetcher
        onFetch={() => new Promise((res) => res('fake data'))}
        persistedState={persistedFetchState}
      />
    );

    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should work with the useMachine hook (rehydrated state config)', async () => {
    const persistedFetchStateConfig = JSON.parse(
      JSON.stringify(persistedFetchState)
    );
    const { getByText, getByTestId } = render(
      <Fetcher
        onFetch={() => new Promise((res) => res('fake data'))}
        persistedState={persistedFetchStateConfig}
      />
    );

    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
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
            ref: () => spawn(new Promise((res) => res(42)), 'my-promise')
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

    const { getByTestId } = render(<Spawner />);
    await waitForElement(() => getByTestId('success'));
    done();
  });

  it('actions should not have stale data', async (done) => {
    const toggleMachine = Machine({
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

    const { getByTestId } = render(<Toggle />);

    const button = getByTestId('button');
    const extButton = getByTestId('extbutton');
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
      service: Interpreter<TestContext, any, any, TestState>;
    }> = ({ service }) => {
      const [state] = useService(service);

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

  it('should capture all actions', (done) => {
    let count = 0;

    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            EVENT: {
              actions: () => {
                count++;
              }
            }
          }
        }
      }
    });

    const App = () => {
      const [stateCount, setStateCount] = useState(0);
      const [state, send] = useMachine(machine);

      React.useEffect(() => {
        send('EVENT');
        send('EVENT');
        send('EVENT');
        send('EVENT');
      }, []);

      React.useEffect(() => {
        setStateCount((c) => c + 1);
      }, [state]);

      return <div data-testid="count">{stateCount}</div>;
    };

    const { getByTestId } = render(<App />);

    const countEl = getByTestId('count');

    // Component should only rerender twice:
    // - 1 time for the initial state
    // - and 1 time for the four (batched) events
    expect(countEl.textContent).toEqual('2');
    expect(count).toEqual(4);
    done();
  });

  it('should capture initial actions', (done) => {
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

    render(<App />);

    expect(count).toEqual(1);
    done();
  });
});
