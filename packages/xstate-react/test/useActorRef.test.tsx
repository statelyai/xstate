import {
  fireEvent,
  screen,
  waitFor as testWaitFor
} from '@testing-library/react';
import * as React from 'react';
import {
  ActorRefFrom,
  fromPromise,
  fromTransition,
  next_createMachine
} from 'xstate';
import { useActorRef, useMachine, useSelector } from '../src/index.ts';
import { describeEachReactMode } from './utils.tsx';
import { z } from 'zod';

afterEach(() => {
  vi.restoreAllMocks();
});

describeEachReactMode('useActorRef (%s)', ({ suiteKey, render }) => {
  it('observer should be called with next state', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
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
            resolve();
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
    return promise;
  });

  it('actions created by a layout effect should access the latest closure values', () => {
    const actual: number[] = [];

    const machine = next_createMachine({
      initial: 'foo',
      actions: {
        recordProp: () => {}
      },
      states: {
        foo: {
          on: {
            // EXEC_ACTION: {
            //   actions: 'recordProp'
            // }
            EXEC_ACTION: ({ actions }, enq) => enq(actions.recordProp)
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
    const machine = next_createMachine({
      initial: 'foo',
      schemas: {
        context: z.object({
          id: z.number()
        })
      },
      guards: {
        hasOverflown: () => false
      },
      context: { id: 1 },
      states: {
        foo: {
          on: {
            // CHECK: {
            //   target: 'bar',
            //   guard: 'hasOverflown'
            // }
            CHECK: ({ guards }) => {
              if (guards.hasOverflown()) {
                return {
                  target: 'bar'
                };
              }
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
            hasOverflown: (() => id > 1) as any
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

  // v6: In strict mode, the stop/restart cycle doesn't restart spawned children
  // because StateMachine.start() no longer auto-starts children
  it('should change state when started', async () => {
    const childMachine = next_createMachine({
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

    const parentMachine = next_createMachine({
      schemas: {
        context: z.object({
          childRef: z.custom<ActorRefFrom<typeof childMachine>>()
        })
      },
      context: ({ spawn }) => ({
        childRef: spawn(childMachine)
      }),
      on: {
        SEND_TO_CHILD: ({ context }, enq) => {
          enq.sendTo(context.childRef, { type: 'EVENT' });
        }
      }
    });

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
          <div data-testid="child-state">{childState.value as string}</div>
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
    const childMachine = next_createMachine({
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

    const parentMachine = next_createMachine({
      // types: {} as {
      //   context: {
      //     childRef: ActorRefFrom<typeof childMachine>;
      //   };
      // },
      schemas: {
        context: z.object({
          childRef: z.custom<ActorRefFrom<typeof childMachine>>()
        })
      },
      context: ({ spawn }) => ({
        childRef: spawn(childMachine)
      }),
      on: {
        // SEND_TO_CHILD: {
        //   actions: sendTo(({ context }) => context.childRef, { type: 'EVENT' })
        // }
        SEND_TO_CHILD: ({ context }, enq) => {
          enq.sendTo(context.childRef, { type: 'EVENT' });
        }
      }
    });

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
          <div data-testid="child-state">{childState.value as string}</div>
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
      () => new Promise<number>((resolve) => setTimeout(() => resolve(42), 10))
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

  it('should be able to rerender with a new machine', () => {
    const machine1 = next_createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const machine2 = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {}
      }
    });

    function Test() {
      const [machine, setMachine] = React.useState(machine1);
      const actorRef = useActorRef(machine);
      const value = useSelector(actorRef, (state) => state.value);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setMachine(machine2 as any);
            }}
          >
            Reload machine
          </button>
          <button
            type="button"
            onClick={() => {
              actorRef.send({
                type: 'NEXT'
              });
            }}
          >
            Send event
          </button>
          <span>{value as string}</span>
        </>
      );
    }

    render(<Test />);

    fireEvent.click(screen.getByText('Reload machine'));
    fireEvent.click(screen.getByText('Send event'));

    expect(screen.getByText('b')).toBeTruthy();
  });

  it('should be able to rehydrate an incoming new machine using the persisted state of the previous one', () => {
    const machine1 = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {}
      }
    });

    const machine2 = next_createMachine({
      initial: 'b',
      states: {
        b: {
          on: { NEXT: 'c' }
        },
        c: {}
      }
    });

    function Test() {
      const [machine, setMachine] = React.useState(machine1);
      const actorRef = useActorRef(machine);
      const value = useSelector(actorRef, (state) => state.value);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setMachine(machine2 as any);
            }}
          >
            Reload machine
          </button>
          <button
            type="button"
            onClick={() => {
              actorRef.send({
                type: 'NEXT'
              });
            }}
          >
            Send event
          </button>
          <span>{value as string}</span>
        </>
      );
    }

    render(<Test />);

    fireEvent.click(screen.getByText('Send event'));
    fireEvent.click(screen.getByText('Reload machine'));
    fireEvent.click(screen.getByText('Send event'));

    expect(screen.getByText('c')).toBeTruthy();
  });

  it('all renders should be consistent - a value derived in render should be derived from the latest source', () => {
    let detectedInconsistency = false;

    const machine1 = next_createMachine({
      tags: ['m1']
    });

    const machine2 = next_createMachine({
      tags: ['m2']
    });

    function Test() {
      const [machine, setMachine] = React.useState(machine1);
      const actorRef = useActorRef(machine);
      const tag = useSelector(actorRef, (state) => [...state.tags][0]);

      detectedInconsistency ||= machine.config.tags![0] !== tag;

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setMachine(machine2 as any);
            }}
          >
            Reload machine
          </button>
        </>
      );
    }

    render(<Test />);

    fireEvent.click(screen.getByText('Reload machine'));

    expect(detectedInconsistency).toBe(false);
  });

  it('all commits should be consistent - a value derived in render should be derived from the latest source', () => {
    let detectedInconsistency = false;

    const machine1 = next_createMachine({
      tags: ['m1']
    });

    const machine2 = next_createMachine({
      tags: ['m2']
    });

    function Test() {
      React.useEffect(() => {
        detectedInconsistency ||= machine.config.tags![0] !== tag;
      });

      const [machine, setMachine] = React.useState(machine1);
      const actorRef = useActorRef(machine);
      const tag = useSelector(actorRef, (state) => [...state.tags][0]);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setMachine(machine2 as any);
            }}
          >
            Reload machine
          </button>
        </>
      );
    }

    render(<Test />);

    fireEvent.click(screen.getByText('Reload machine'));

    expect(detectedInconsistency).toBe(false);
  });

  it("should execute action bound to a specific machine's instance when the action is provided in render", () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();

    const machine = next_createMachine({
      actions: {
        stuff: spy1
      },
      on: {
        // DO: {
        //   actions: 'stuff'
        // }
        DO: ({ actions }, enq) => enq(actions.stuff)
      }
    });

    const Test = () => {
      const actorRef1 = useActorRef(
        machine.provide({
          actions: {
            stuff: spy1
          }
        })
      );
      useActorRef(
        machine.provide({
          actions: {
            stuff: spy2
          }
        })
      );

      return (
        <button
          type="button"
          onClick={() => {
            actorRef1.send({
              type: 'DO'
            });
          }}
        >
          Click
        </button>
      );
    };

    render(<Test />);

    screen.getByRole('button').click();

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).not.toHaveBeenCalled();
  });
});
