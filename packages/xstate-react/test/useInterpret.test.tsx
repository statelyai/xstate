import * as React from 'react';
import {
  ActorRefFrom,
  createMachine,
  fromPromise,
  fromTransition,
  sendTo
} from 'xstate';
import { fireEvent, screen } from '@testing-library/react';
import {
  useActor,
  useInterpret,
  useMachine,
  useSelector
} from '../src/index.ts';
import { describeEachReactMode } from './utils';

const originalConsoleWarn = console.warn;

afterEach(() => {
  console.warn = originalConsoleWarn;
});

describeEachReactMode('useInterpret (%s)', ({ suiteKey, render }) => {
  it('observer should be called with next state', (done) => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: 'active'
          }
        },
        active: {}
      }
    });

    const App = () => {
      const service = useInterpret(machine);

      React.useEffect(() => {
        service.subscribe((state) => {
          if (state.matches('active')) {
            done();
          }
        });
      }, [service]);

      return (
        <button
          data-testid="button"
          onClick={() => {
            service.send({ type: 'ACTIVATE' });
          }}
        ></button>
      );
    };

    render(<App />);
    const button = screen.getByTestId('button');

    fireEvent.click(button);
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
      const service = useInterpret(
        machine.provide({
          actions: {
            recordProp: () => actual.push(value)
          }
        })
      );

      React.useLayoutEffect(() => {
        service.send({ type: 'EXEC_ACTION' });
      });

      return null;
    };

    const { rerender } = render(<App value={1} />);

    expect(actual).toEqual(suiteKey === 'strict' ? [1, 1] : [1]);

    actual.length = 0;
    rerender(<App value={42} />);

    expect(actual).toEqual([42]);
  });

  it('should warn when machine reference is updated during the hook lifecycle', () => {
    console.warn = jest.fn();
    const createTestMachine = () =>
      createMachine({
        initial: 'foo',
        context: { id: 1 },
        states: {
          foo: {
            on: {
              CHECK: {
                target: 'bar',
                guard: 'hasOverflown'
              }
            }
          },
          bar: {}
        }
      });
    const App = () => {
      const [, setId] = React.useState(1);
      const [, send] = useMachine(createTestMachine());

      return (
        <>
          <button
            onClick={() => {
              setId(2);
              send({ type: 'CHECK' });
            }}
          >
            update id
          </button>
        </>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(console.warn).toHaveBeenCalledTimes(suiteKey === 'strict' ? 4 : 1);
    expect((console.warn as jest.Mock).mock.calls[0][0]).toMatchInlineSnapshot(`
      "Machine given to \`useMachine\` has changed between renders. This is not supported and might lead to unexpected results.
      Please make sure that you pass the same Machine as argument each time."
    `);
    if (suiteKey === 'strict') {
      expect((console.warn as jest.Mock).mock.calls[1][0])
        .toMatchInlineSnapshot(`
        "Machine given to \`useMachine\` has changed between renders. This is not supported and might lead to unexpected results.
        Please make sure that you pass the same Machine as argument each time."
      `);
    }
  });

  it('should not warn when only the provided machine implementations have changed', () => {
    console.warn = jest.fn();
    const machine = createMachine({
      initial: 'foo',
      context: { id: 1 },
      states: {
        foo: {
          on: {
            CHECK: {
              target: 'bar',
              guard: 'hasOverflown'
            }
          }
        },
        bar: {}
      }
    });

    const App = () => {
      const [id, setId] = React.useState(1);
      const [, send] = useMachine(
        machine.provide({
          guards: {
            hasOverflown: () => id > 1
          }
        })
      );

      return (
        <>
          <button
            onClick={() => {
              setId(2);
              send({ type: 'CHECK' });
            }}
          >
            update id
          </button>
        </>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should change state when started', async () => {
    const childMachine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: 'received'
          }
        },
        received: {}
      }
    });

    const parentMachine = createMachine<{
      childRef: ActorRefFrom<typeof childMachine>;
    }>({
      context: ({ spawn }) => ({
        childRef: spawn(childMachine)
      }),
      on: {
        SEND_TO_CHILD: {
          actions: sendTo(({ context }) => context.childRef, { type: 'EVENT' })
        }
      }
    });

    const App = () => {
      const parentActor = useInterpret(parentMachine);
      const [parentState, parentSend] = useActor(parentActor);
      const [childState] = useActor(parentState.context.childRef);

      return (
        <>
          <button
            data-testid="button"
            onClick={() => parentSend({ type: 'SEND_TO_CHILD' })}
          >
            Send to child
          </button>
          <div data-testid="child-state">{childState.value}</div>
        </>
      );
    };

    render(<App />);

    const button = screen.getByTestId('button');
    const childState = screen.getByTestId('child-state');

    expect(childState.textContent).toBe('waiting');

    fireEvent.click(button);

    expect(childState.textContent).toBe('received');
  });

  it('should change state when started (useMachine)', async () => {
    const childMachine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: 'received'
          }
        },
        received: {}
      }
    });

    const parentMachine = createMachine<{
      childRef: ActorRefFrom<typeof childMachine>;
    }>({
      context: ({ spawn }) => ({
        childRef: spawn(childMachine)
      }),
      on: {
        SEND_TO_CHILD: {
          actions: sendTo(({ context }) => context.childRef, { type: 'EVENT' })
        }
      }
    });

    const App = () => {
      const [parentState, parentSend] = useMachine(parentMachine);
      const [childState] = useActor(parentState.context.childRef);

      return (
        <>
          <button
            data-testid="button"
            onClick={() => parentSend({ type: 'SEND_TO_CHILD' })}
          >
            Send to child
          </button>
          <div data-testid="child-state">{childState.value}</div>
        </>
      );
    };

    render(<App />);

    const button = screen.getByTestId('button');
    const childState = screen.getByTestId('child-state');

    expect(childState.textContent).toBe('waiting');

    fireEvent.click(button);

    expect(childState.textContent).toBe('received');
  });

  it('should deliver messages sent from an effect to the root actor registered in the system', () => {
    const spy = jest.fn();
    const m = createMachine({
      on: {
        PING: {
          actions: spy
        }
      }
    });

    const App = () => {
      const actor = useInterpret(m, { systemId: 'test' });

      React.useEffect(() => {
        actor.system?.get('test')!.send({ type: 'PING' });
      });

      return null;
    };

    render(<App />);

    expect(spy).toHaveBeenCalledTimes(suiteKey === 'strict' ? 2 : 1);
  });

  it('should work with any behavior', async () => {
    const App = () => {
      const actor = useInterpret(() =>
        fromTransition((state, event) => {
          if (event.type === 'inc') {
            return state + 1;
          }
          return state;
        }, 0)
      );

      const count = useSelector(actor, (state) => state);

      return (
        <div
          data-testid="count"
          onClick={() => {
            actor.send({ type: 'inc' });
          }}
        >
          {count}
        </div>
      );
    };

    render(<App />);

    const count = screen.getByTestId('count');

    expect(count.textContent).toBe('0');

    fireEvent.click(count);

    expect(count.textContent).toBe('1');
  });
});
