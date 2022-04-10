import * as React from 'react';
import { useMachine } from '../src/fsm';
import { createMachine, assign, interpret, StateMachine } from '@xstate/fsm';
import { fireEvent, screen } from '@testing-library/react';
import { describeEachReactMode } from './utils';

describeEachReactMode('useMachine, fsm (%s)', ({ suiteKey, render }) => {
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

  const Fetcher: React.FC<{
    onFetch: () => Promise<any>;
  }> = ({ onFetch = () => new Promise((res) => res('some data')) }) => {
    const [current, send] = useMachine(fetchMachine, {
      actions: {
        load: () =>
          onFetch().then((res) => {
            send({ type: 'RESOLVE', data: res });
          })
      }
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

  it('should provide the service', () => {
    const Test = () => {
      const [, , service] = useMachine(fetchMachine);

      expect(typeof service.send).toBe('function');

      return null;
    };

    render(<Test />);
  });

  it('actions should not have stale data', async (done) => {
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
      const [ext, setExt] = React.useState(false);

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

  it('should keep options defined on a machine when they are not possed to `useMachine` hook', async (done) => {
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

      React.useEffect(() => {
        send('TOGGLE');
        expect(actual).toEqual(true);
        done();
      }, []);

      return null;
    };

    render(<Comp />);
  });

  it('should be able to lookup initial action passed to the hook', async (done) => {
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

      React.useEffect(() => {
        expect(outer).toBe(false);
        expect(inner).toBe(true);
        done();
      }, []);

      return null;
    };

    render(<Comp />);
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
          doAction() {}
        }
      });

      return null;
    };

    render(<Comp />);

    const service = interpret(machine).start();
    service.send('EV');
    expect(flag).toBe(true);
  });

  // Example from: https://github.com/statelyai/xstate/discussions/1944
  it('fsm useMachine service should be typed correctly', () => {
    interface Context {
      count?: number;
    }

    type Event = { type: 'READY' };

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

    const useCustomService = (service: Service) =>
      React.useEffect(() => {}, [service]);

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

  it('actions created by a layout effect should access the latest closure values', () => {
    const actual: number[] = [];

    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            EXEC_ACTION: {
              actions: 'recordProp'
            }
          }
        }
      }
    });

    const App = ({ value }: { value: number }) => {
      const [, send] = useMachine(machine, {
        actions: {
          recordProp: () => actual.push(value)
        }
      });

      React.useLayoutEffect(() => {
        send('EXEC_ACTION');
      }, [value]);

      return null;
    };

    const { rerender } = render(<App value={1} />);

    expect(actual).toEqual(suiteKey === 'strict' ? [1, 1] : [1]);

    actual.length = 0;
    rerender(<App value={42} />);

    expect(actual).toEqual([42]);
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

  it('should not execute actions (side-effects) in render', () => {
    let entryActionCalled = false;

    const machine = createMachine({
      initial: 'init',
      states: {
        init: {
          entry: () => (entryActionCalled = true)
        }
      }
    });

    const Test = () => {
      useMachine(machine);
      expect(entryActionCalled).toBe(false);
      return null;
    };

    render(<Test />);
  });

  it('should only execute actions once when mounting', () => {
    let entryActionCalled = 0;

    const machine = createMachine({
      initial: 'init',
      states: {
        init: {
          entry: () => entryActionCalled++
        }
      }
    });

    const Test = () => {
      useMachine(machine);
      return null;
    };

    render(<Test />);

    // in StrictMode this would return 2 if we wouldn't be calling `.start(persistedState)` in an effect
    expect(entryActionCalled).toEqual(1);
  });
});
