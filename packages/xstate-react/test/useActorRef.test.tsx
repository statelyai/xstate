import * as React from 'react';
import {
  ActorRefFrom,
  assign,
  createMachine,
  fromPromise,
  fromTransition,
  sendParent,
  sendTo
} from 'xstate';
import {
  fireEvent,
  screen,
  waitFor as testWaitFor
} from '@testing-library/react';
import { useActorRef, useMachine, useSelector } from '../src/index.ts';
import { describeEachReactMode } from './utils.tsx';

const originalConsoleWarn = console.warn;

afterEach(() => {
  console.warn = originalConsoleWarn;
});

describeEachReactMode('useActorRef (%s)', ({ suiteKey, render }) => {
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
      const actorRef = useActorRef(machine);

      React.useEffect(() => {
        actorRef.subscribe((state) => {
          if (state.matches('active')) {
            done();
          }
        });
      }, [actorRef]);

      return (
        <button
          data-testid="button"
          onClick={() => {
            actorRef.send({ type: 'ACTIVATE' });
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
      const service = useActorRef(
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

  it('should rerender OK when only the provided machine implementations have changed', () => {
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
      useMachine(
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
            }}
          >
            update id
          </button>
          <span>{id}</span>
        </>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('2')).toBeTruthy();
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

    const parentMachine = createMachine(
      {
        types: {} as {
          context: { childRef: ActorRefFrom<typeof childMachine> };
        },
        context: ({ spawn }) => ({
          childRef: spawn('child')
        }),
        on: {
          SEND_TO_CHILD: {
            actions: sendTo(({ context }) => context.childRef, {
              type: 'EVENT'
            })
          }
        }
      },
      {
        actors: {
          child: childMachine
        }
      }
    );

    const App = () => {
      const parentActor = useActorRef(parentMachine);
      const parentState = useSelector(parentActor, (s) => s);
      const childState = useSelector(parentState.context.childRef, (s) => s);

      return (
        <>
          <button
            data-testid="button"
            onClick={() => parentActor.send({ type: 'SEND_TO_CHILD' })}
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

    const parentMachine = createMachine(
      {
        types: {} as {
          context: {
            childRef: ActorRefFrom<typeof childMachine>;
          };
        },
        context: ({ spawn }) => ({
          childRef: spawn('child')
        }),
        on: {
          SEND_TO_CHILD: {
            actions: sendTo(({ context }) => context.childRef, {
              type: 'EVENT'
            })
          }
        }
      },
      {
        actors: {
          child: childMachine
        }
      }
    );

    const App = () => {
      const [parentState, parentSend] = useMachine(parentMachine);
      const childState = useSelector(parentState.context.childRef, (s) => s);

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
      const actor = useActorRef(m, { systemId: 'test' });

      React.useEffect(() => {
        actor.system?.get('test')!.send({ type: 'PING' });
      });

      return null;
    };

    render(<App />);

    expect(spy).toHaveBeenCalledTimes(suiteKey === 'strict' ? 2 : 1);
  });

  it('should work with a transition actor', () => {
    const someLogic = fromTransition((state, event) => {
      if (event.type == 'inc') {
        return state + 1;
      }
      return state;
    }, 0);

    const App = () => {
      const actorRef = useActorRef(someLogic);
      const count = useSelector(actorRef, (state) => state);

      return (
        <div data-testid="count" onClick={() => actorRef.send({ type: 'inc' })}>
          {count.context}
        </div>
      );
    };

    render(<App />);

    const count = screen.getByTestId('count');

    expect(count.textContent).toBe('0');

    fireEvent.click(count);

    expect(count.textContent).toBe('1');
  });

  it('should work with a promise actor', async () => {
    const promiseLogic = fromPromise(
      () => new Promise((resolve) => setTimeout(() => resolve(42), 10))
    );

    const App = () => {
      const actorRef = useActorRef(promiseLogic);
      const count = useSelector(actorRef, (state) => state);

      return <div data-testid="count">{count.output}</div>;
    };

    render(<App />);

    const count = screen.getByTestId('count');

    expect(count.textContent).toBe('');

    await testWaitFor(() => expect(count.textContent).toBe('42'));
  });

  it('invoked actor should be able to receive (deferred) events that it replays when active', () => {
    let isDone = false;

    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent({ type: 'FINISH' }) }
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

    const ChildTest: React.FC<{
      actor: ActorRefFrom<typeof childMachine>;
    }> = ({ actor }) => {
      const state = useSelector(actor, (s) => s);

      expect(state.value).toEqual('active');

      React.useLayoutEffect(() => {
        if (actor.getSnapshot().status === 'active') {
          actor.send({ type: 'FINISH' });
        }
      }, []);

      return null;
    };

    const Test = () => {
      const actorRef = useActorRef(machine);
      const childActor = useSelector(
        actorRef,
        (s) => s.children.child as ActorRefFrom<typeof childMachine>
      );

      isDone = useSelector(actorRef, (s) => s.matches('success'));

      return <ChildTest actor={childActor} />;
    };

    render(<Test />);

    expect(isDone).toBe(true);
  });

  it('spawned actor should be able to receive (deferred) events that it replays when active', () => {
    let isDone = false;

    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent({ type: 'FINISH' }) }
          }
        }
      }
    });
    const machine = createMachine(
      {
        initial: 'active',
        states: {
          active: {
            entry: assign({
              actorRef: ({ spawn }) => spawn('child', { id: 'child' })
            }),
            on: { FINISH: 'success' }
          },
          success: {}
        }
      },
      {
        actors: {
          child: childMachine
        }
      }
    );

    const ChildTest: React.FC<{
      actor: ActorRefFrom<typeof childMachine>;
    }> = ({ actor }) => {
      const state = useSelector(actor, (s) => s);

      expect(state.value).toEqual('active');

      React.useLayoutEffect(() => {
        if (actor.getSnapshot().status === 'active') {
          actor.send({ type: 'FINISH' });
        }
      }, []);

      return null;
    };

    const Test = () => {
      const actorRef = useActorRef(machine);
      const childActor = useSelector(
        actorRef,
        (s) => s.children.child as ActorRefFrom<typeof childMachine>
      );

      isDone = useSelector(actorRef, (s) => s.matches('success'));

      return <ChildTest actor={childActor} />;
    };

    render(<Test />);

    expect(isDone).toBe(true);
  });
});
