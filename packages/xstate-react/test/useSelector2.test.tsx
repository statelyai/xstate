import { act, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { useState } from 'react';
import {
  ActorRef,
  ActorRefFrom,
  assign,
  createMachine,
  interpret,
  sendParent
} from 'xstate';
import { useMachine, useActorRef, useSelector } from '../src/index.ts';
import { describeEachReactMode } from './utils.tsx';
import { createEmptyActor, fromTransition } from 'xstate/actors';

const originalConsoleError = console.error;

afterEach(() => {
  console.error = originalConsoleError;
});

describeEachReactMode('useActor (%s)', ({ render, suiteKey }) => {
  it('initial invoked actor should be immediately available', () => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {}
      }
    });

    const ChildTest: React.FC<{ actor: ActorRefFrom<typeof childMachine> }> = ({
      actor
    }) => {
      const state = useSelector(actor, (s) => s);

      expect(state.value).toEqual('active');

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);

      return (
        <ChildTest
          actor={state.children.child as ActorRefFrom<typeof childMachine>}
        />
      );
    };

    render(<Test />);
  });

  // TODO: reexecuted layout effect in strict mode sees the outdated state
  // it fires after passive cleanup (that stops the machine) and before the passive setup (that restarts the machine)
  (suiteKey === 'strict' ? it.skip : it)(
    'invoked actor should be able to receive (deferred) events that it replays when active',
    (done) => {
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
          actor.send({ type: 'FINISH' });
        }, []);

        return null;
      };

      const Test = () => {
        const [state] = useMachine(machine);

        if (state.matches('success')) {
          done();
        }

        return (
          <ChildTest
            actor={state.children.child as ActorRefFrom<typeof childMachine>}
          />
        );
      };

      render(<Test />);
    }
  );

  it('initial spawned actor should be immediately available', () => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });

    interface Ctx {
      actorRef: ActorRefFrom<typeof childMachine>;
    }

    const machine = createMachine<Ctx>({
      initial: 'active',
      context: {} as Ctx,
      states: {
        active: {
          entry: assign({
            actorRef: ({ spawn }) => spawn(childMachine)
          })
        }
      }
    });

    const ChildTest: React.FC<{ actor: ActorRefFrom<typeof childMachine> }> = ({
      actor
    }) => {
      const state = useSelector(actor, (s) => s);

      expect(state.value).toEqual('active');

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      const { actorRef } = state.context;

      return <ChildTest actor={actorRef!} />;
    };

    render(<Test />);
  });

  // TODO: reexecuted layout effect in strict mode sees the outdated state
  // it fires after passive cleanup (that stops the machine) and before the passive setup (that restarts the machine)
  (suiteKey === 'strict' ? it.skip : it)(
    'spawned actor should be able to receive (deferred) events that it replays when active',
    (done) => {
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

      const machine = createMachine<{
        actorRef?: ActorRefFrom<typeof childMachine>;
      }>({
        initial: 'active',
        context: {
          actorRef: undefined
        },
        states: {
          active: {
            entry: assign({
              actorRef: ({ spawn }) => spawn(childMachine, { id: 'child' })
            }),
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
          actor.send({ type: 'FINISH' });
        }, []);

        return null;
      };

      const Test = () => {
        const [state] = useMachine(machine);

        if (state.matches('success')) {
          done();
        }

        const { actorRef } = state.context;

        return <ChildTest actor={actorRef!} />;
      };

      render(<Test />);
    }
  );

  it('actor should provide snapshot value immediately', () => {
    const simpleActor = interpret({
      transition: (s) => s,
      getSnapshot: () => 42,
      getInitialState: () => 42
    });

    const Test = () => {
      const state = useSelector(simpleActor, (s) => s);

      return <div data-testid="state">{state}</div>;
    };

    render(<Test />);

    const div = screen.getByTestId('state');

    expect(div.textContent).toEqual('42');
  });

  it('should update snapshot value when actor changes', () => {
    const createSimpleActor = (value: number) =>
      interpret({
        transition: (s) => s,
        getSnapshot: () => value,
        getInitialState: () => value
      });

    const Test = () => {
      const [actor, setActor] = useState(createSimpleActor(42));
      const state = useSelector(actor, (s) => s);

      return (
        <>
          <div data-testid="state">{state}</div>
          <button
            data-testid="button"
            onClick={() => setActor(createSimpleActor(100))}
          ></button>
        </>
      );
    };

    render(<Test />);

    const div = screen.getByTestId('state');
    const button = screen.getByTestId('button');

    expect(div.textContent).toEqual('42');
    fireEvent.click(button);
    expect(div.textContent).toEqual('100');
  });

  it('send() should be stable for the same actor', () => {
    const noop = () => {};
    const fakeSubscribe = () => ({
      unsubscribe: noop
    });

    const actor = interpret({
      transition: (s) => s,
      subscribe: fakeSubscribe,
      getSnapshot: () => undefined,
      getInitialState: () => undefined
    });

    let latestSend: (...args: any[]) => void;

    const Test = () => {
      const [, setState] = useState(0);

      latestSend = actor.send;

      return (
        <>
          <button
            data-testid="button"
            onClick={() => setState((i) => ++i)}
          ></button>
        </>
      );
    };

    render(<Test />);

    const firstSend = latestSend!;

    const button = screen.getByTestId('button');
    fireEvent.click(button);

    expect(firstSend).toBe(latestSend!);
  });

  it('send() should get updated when the actor changes', () => {
    const noop = () => {};
    const fakeSubscribe = () => ({
      unsubscribe: noop
    });
    const firstActor = interpret({
      transition: (s) => s,
      subscribe: fakeSubscribe,
      getSnapshot: () => undefined,
      getInitialState: () => undefined
    });
    const lastActor = interpret({
      transition: (s) => s,
      subscribe: fakeSubscribe,
      getSnapshot: () => undefined,
      getInitialState: () => undefined
    });

    let latestSend: (...args: any[]) => void;

    const Test = () => {
      const [actor, setActor] = useState(firstActor);

      latestSend = actor.send;

      return (
        <>
          <button
            data-testid="button"
            onClick={() => setActor(lastActor)}
          ></button>
        </>
      );
    };

    render(<Test />);

    const firstSend = latestSend!;

    const button = screen.getByTestId('button');
    fireEvent.click(button);

    expect(firstSend).not.toBe(latestSend!);
  });

  it('should also work with services', () => {
    const counterMachine = createMachine<
      { count: number },
      { type: 'INC' } | { type: 'SOMETHING' }
    >(
      {
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              INC: {
                actions: assign({ count: ({ context }) => context.count + 1 })
              },
              SOMETHING: { actions: 'doSomething' }
            }
          }
        }
      },
      {
        actions: {
          doSomething: () => {
            /* do nothing */
          }
        }
      }
    );
    const counterActor = interpret(counterMachine).start();

    const Counter = () => {
      const state = useSelector(counterActor, (s) => s);

      return (
        <div
          data-testid="count"
          onClick={() => {
            counterActor.send({ type: 'INC' });
            // @ts-expect-error
            counterActor.send({ type: 'FAKE' });
          }}
        >
          {state.context.count}
        </div>
      );
    };

    render(
      <>
        <Counter />
        <Counter />
      </>
    );

    const countEls = screen.getAllByTestId('count');

    expect(countEls.length).toBe(2);

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('0');
    });

    act(() => {
      counterActor.send({ type: 'INC' });
    });

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('1');
    });
  });

  it('should work with initially deferred actors spawned in lazy context', () => {
    const childMachine = createMachine({
      initial: 'one',
      states: {
        one: {
          on: { NEXT: 'two' }
        },
        two: {}
      }
    });

    const machine = createMachine<{ ref: ActorRef<any> }>({
      context: ({ spawn }) => ({
        ref: spawn(childMachine)
      }),
      initial: 'waiting',
      states: {
        waiting: {
          on: { TEST: 'success' }
        },
        success: {
          type: 'final'
        }
      }
    });

    const App = () => {
      const [state] = useMachine(machine);
      const childState = useSelector(state.context.ref, (s) => s);

      return (
        <>
          <div data-testid="child-state">{childState.value}</div>
          <button
            data-testid="child-send"
            onClick={() => state.context.ref.send({ type: 'NEXT' })}
          ></button>
        </>
      );
    };

    render(<App />);

    const elState = screen.getByTestId('child-state');
    const elSend = screen.getByTestId('child-send');

    expect(elState.textContent).toEqual('one');
    fireEvent.click(elSend);

    expect(elState.textContent).toEqual('two');
  });

  it('should not log any spurious errors when used with a not-started actor', () => {
    const spy = jest.fn();
    console.error = spy;

    const machine = createMachine({});
    const App = () => {
      useSelector(useActorRef(machine), (s) => s);

      return null;
    };

    render(<App />);

    expect(spy).not.toBeCalled();
  });

  it('should work with a null actor', () => {
    const Child = (props: {
      actor: ActorRef<any, { count: number }> | undefined;
    }) => {
      const state = useSelector(props.actor ?? createEmptyActor(), (s) => s);

      // @ts-expect-error
      ((_accept: { count: number }) => {})(state);
      ((_accept: { count: number } | undefined) => {})(state);

      return <div data-testid="state">{state?.count ?? 'undefined'}</div>;
    };

    const App = () => {
      const [actor, setActor] = useState<ActorRef<any, { count: number }>>();

      return (
        <>
          <button
            data-testid="button"
            onClick={() =>
              setActor(interpret(fromTransition((s) => s, { count: 42 })))
            }
          >
            Set actor
          </button>
          <Child actor={actor} />
        </>
      );
    };

    render(<App />);

    const button = screen.getByTestId('button');
    const stateEl = screen.getByTestId('state');

    expect(stateEl.textContent).toBe('undefined');

    fireEvent.click(button);

    expect(stateEl.textContent).toBe('42');
  });
});