import { act, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import {
  ActorRef,
  ActorRefFrom,
  AnyState,
  assign,
  createMachine,
  interpret,
  spawn,
  StateFrom,
  toActorRef
} from 'xstate';
import { shallowEqual, useInterpret, useMachine, useSelector } from '../src';
import { describeEachReactMode } from './utils';

const originalConsoleError = console.error;

afterEach(() => {
  console.error = originalConsoleError;
});

describeEachReactMode('useSelector (%s)', ({ suiteKey, render }) => {
  it('only rerenders for selected values', () => {
    const machine = createMachine<{ count: number; other: number }>({
      initial: 'active',
      context: {
        other: 0,
        count: 0
      },
      states: {
        active: {}
      },
      on: {
        OTHER: {
          actions: assign({ other: (ctx) => ctx.other + 1 })
        },
        INCREMENT: {
          actions: assign({ count: (ctx) => ctx.count + 1 })
        }
      }
    });

    let rerenders = 0;

    const App = () => {
      const service = useInterpret(machine);
      const count = useSelector(service, (state) => state.context.count);

      rerenders++;

      return (
        <>
          <div data-testid="count">{count}</div>
          <button
            data-testid="other"
            onClick={() => service.send('OTHER')}
          ></button>
          <button
            data-testid="increment"
            onClick={() => service.send('INCREMENT')}
          ></button>
        </>
      );
    };

    render(<App />);
    const countButton = screen.getByTestId('count');
    const otherButton = screen.getByTestId('other');
    const incrementEl = screen.getByTestId('increment');

    fireEvent.click(incrementEl);

    rerenders = 0;

    fireEvent.click(otherButton);
    fireEvent.click(otherButton);
    fireEvent.click(otherButton);
    fireEvent.click(otherButton);

    expect(rerenders).toEqual(0);

    fireEvent.click(incrementEl);

    expect(countButton.textContent).toBe('2');
  });

  it('should work with a custom comparison function', () => {
    const machine = createMachine<{ name: string }>({
      initial: 'active',
      context: {
        name: 'david'
      },
      states: {
        active: {}
      },
      on: {
        CHANGE: {
          actions: assign({ name: (_, e) => e.value })
        }
      }
    });

    const App = () => {
      const service = useInterpret(machine);
      const name = useSelector(
        service,
        (state) => state.context.name,
        (a, b) => a.toUpperCase() === b.toUpperCase()
      );

      return (
        <>
          <div data-testid="name">{name}</div>
          <button
            data-testid="sendUpper"
            onClick={() => service.send({ type: 'CHANGE', value: 'DAVID' })}
          ></button>
          <button
            data-testid="sendOther"
            onClick={() => service.send({ type: 'CHANGE', value: 'other' })}
          ></button>
        </>
      );
    };

    render(<App />);
    const nameEl = screen.getByTestId('name');
    const sendUpperButton = screen.getByTestId('sendUpper');
    const sendOtherButton = screen.getByTestId('sendOther');

    expect(nameEl.textContent).toEqual('david');

    fireEvent.click(sendUpperButton);

    // unchanged due to comparison function
    expect(nameEl.textContent).toEqual('david');

    fireEvent.click(sendOtherButton);

    expect(nameEl.textContent).toEqual('other');

    fireEvent.click(sendUpperButton);

    expect(nameEl.textContent).toEqual('DAVID');
  });

  it('should work with the shallowEqual comparison function', () => {
    const machine = createMachine<{ user: { name: string } }>({
      initial: 'active',
      context: {
        user: { name: 'david' }
      },
      states: {
        active: {}
      },
      on: {
        'change.same': {
          // New object reference
          actions: assign({ user: { name: 'david' } })
        },
        'change.other': {
          // New object reference
          actions: assign({ user: { name: 'other' } })
        }
      }
    });

    const App = () => {
      const service = useInterpret(machine);
      const [userChanges, setUserChanges] = React.useState(0);
      const user = useSelector(
        service,
        (state) => state.context.user,
        shallowEqual
      );
      const prevUser = React.useRef(user);

      React.useEffect(() => {
        if (user !== prevUser.current) {
          setUserChanges((c) => c + 1);
        }
        prevUser.current = user;
      }, [user]);

      return (
        <>
          <div data-testid="name">{user.name}</div>
          <div data-testid="changes">{userChanges}</div>
          <button
            data-testid="sendSame"
            onClick={() => service.send({ type: 'change.same' })}
          ></button>
          <button
            data-testid="sendOther"
            onClick={() => service.send({ type: 'change.other' })}
          ></button>
        </>
      );
    };

    render(<App />);
    const nameEl = screen.getByTestId('name');
    const changesEl = screen.getByTestId('changes');
    const sendSameButton = screen.getByTestId('sendSame');
    const sendOtherButton = screen.getByTestId('sendOther');

    expect(nameEl.textContent).toEqual('david');

    // unchanged due to comparison function
    fireEvent.click(sendSameButton);
    expect(nameEl.textContent).toEqual('david');
    expect(changesEl.textContent).toEqual('0');

    // changed
    fireEvent.click(sendOtherButton);
    expect(nameEl.textContent).toEqual('other');
    expect(changesEl.textContent).toEqual('1');

    // changed
    fireEvent.click(sendSameButton);
    expect(nameEl.textContent).toEqual('david');
    expect(changesEl.textContent).toEqual('2');

    // unchanged due to comparison function
    fireEvent.click(sendSameButton);
    expect(nameEl.textContent).toEqual('david');
    expect(changesEl.textContent).toEqual('2');
  });

  it('should work with selecting values from initially spawned actors', () => {
    const childMachine = createMachine<{ count: number }>({
      context: {
        count: 0
      },
      on: {
        UPDATE_COUNT: {
          actions: assign({
            count: (ctx) => ctx.count + 1
          })
        }
      }
    });

    const parentMachine = createMachine({
      schema: {
        context: {} as { childActor: ActorRefFrom<typeof childMachine> }
      },
      entry: assign({
        childActor: () => spawn(childMachine)
      })
    });

    const selector = (state: StateFrom<typeof childMachine>) =>
      state.context.count;

    const App = () => {
      const [state] = useMachine(parentMachine);
      const actor = state.context.childActor;
      const count = useSelector(actor, selector);

      return (
        <>
          <div data-testid="count">{count}</div>

          <button
            onClick={() => actor.send({ type: 'UPDATE_COUNT' })}
            data-testid="button"
          />
        </>
      );
    };

    render(<App />);

    const buttonEl = screen.getByTestId('button');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toEqual('0');
    fireEvent.click(buttonEl);
    expect(countEl.textContent).toEqual('1');
  });

  it('should render custom snapshot of initially spawned custom actor', () => {
    const createActor = (latestValue: string) => ({
      ...toActorRef({
        send: () => {},
        subscribe: () => {
          return { unsubscribe: () => {} };
        }
      }),
      latestValue
    });

    const parentMachine = createMachine({
      schema: {
        context: {} as {
          childActor: ActorRef<any, any>;
        }
      },
      entry: assign({
        childActor: () => spawn(createActor('foo'))
      })
    });

    const identitySelector = (value: any) => value;
    const getSnapshot = (actor: ActorRef<any, any>) =>
      (actor as any).latestValue;

    const App = () => {
      const [state] = useMachine(parentMachine);
      const actor = state.context.childActor;

      const value = useSelector(
        actor,
        identitySelector,
        undefined,
        getSnapshot
      );

      return <>{value}</>;
    };

    const { container } = render(<App />);
    expect(container.textContent).toEqual('foo');
  });

  it('should rerender with a new value when the selector changes', () => {
    const childMachine = createMachine<{ count: number }>({
      context: {
        count: 0
      },
      on: {
        INC: {
          actions: assign({
            count: (ctx) => ctx.count + 1
          })
        }
      }
    });

    const parentMachine = createMachine({
      schema: {
        context: {} as { childActor: ActorRefFrom<typeof childMachine> }
      },
      entry: assign({
        childActor: () => spawn(childMachine)
      })
    });

    const App = ({ prop }: { prop: string }) => {
      const [state] = useMachine(parentMachine);
      const actor = state.context.childActor;
      const value = useSelector(
        actor,
        (state) => `${prop} ${state.context.count}`
      );

      return <div data-testid="value">{value}</div>;
    };

    const { container, rerender } = render(<App prop="first" />);

    expect(container.textContent).toEqual('first 0');

    rerender(<App prop="second" />);
    expect(container.textContent).toEqual('second 0');
  });

  it('should use a fresh selector for subscription updates after selector change', () => {
    const childMachine = createMachine<{ count: number }>({
      context: {
        count: 0
      },
      on: {
        INC: {
          actions: assign({
            count: (ctx) => ctx.count + 1
          })
        }
      }
    });

    const parentMachine = createMachine({
      schema: {
        context: {} as { childActor: ActorRefFrom<typeof childMachine> }
      },
      entry: assign({
        childActor: () => spawn(childMachine)
      })
    });

    const App = ({ prop }: { prop: string }) => {
      const [state] = useMachine(parentMachine);
      const actor = state.context.childActor;
      const value = useSelector(
        actor,
        (state) => `${prop} ${state.context.count}`
      );

      return (
        <>
          <div data-testid="value">{value}</div>

          <button onClick={() => actor.send({ type: 'INC' })} />
        </>
      );
    };

    const { rerender } = render(<App prop="first" />);

    const buttonEl = screen.getByRole('button');
    const valueEl = screen.getByTestId('value');

    expect(valueEl.textContent).toEqual('first 0');

    rerender(<App prop="second" />);
    fireEvent.click(buttonEl);

    expect(valueEl.textContent).toEqual('second 1');
  });

  it("should render snapshot value when actor doesn't emit anything", () => {
    const createActor = (latestValue: string) => ({
      ...toActorRef({
        send: () => {},
        subscribe: () => {
          return { unsubscribe: () => {} };
        }
      }),
      latestValue
    });

    const parentMachine = createMachine({
      schema: {
        context: {} as {
          childActor: ActorRef<any, any>;
        }
      },
      entry: assign({
        childActor: () => spawn(createActor('foo'))
      })
    });

    const identitySelector = (value: any) => value;
    const getSnapshot = (actor: ActorRef<any, any>) =>
      (actor as any).latestValue;

    const App = () => {
      const [state] = useMachine(parentMachine);
      const actor = state.context.childActor;

      const value = useSelector(
        actor,
        identitySelector,
        undefined,
        getSnapshot
      );

      return <>{value}</>;
    };

    const { container } = render(<App />);
    expect(container.textContent).toEqual('foo');
  });

  it('should render snapshot state when actor changes', () => {
    const createActor = (latestValue: string) => ({
      ...toActorRef({
        send: () => {},
        subscribe: () => {
          return { unsubscribe: () => {} };
        }
      }),
      latestValue
    });

    const actor1 = createActor('foo');
    const actor2 = createActor('bar');

    const identitySelector = (value: any) => value;
    const getSnapshot = (actor: ReturnType<typeof createActor>) =>
      actor.latestValue;

    const App = ({ prop }: { prop: string }) => {
      const value = useSelector(
        prop === 'first' ? actor1 : actor2,
        identitySelector,
        undefined,
        getSnapshot
      );

      return <>{value}</>;
    };

    const { container, rerender } = render(<App prop="first" />);
    expect(container.textContent).toEqual('foo');

    rerender(<App prop="second" />);
    expect(container.textContent).toEqual('bar');
  });

  it("should keep rendering a new selected value after selector change when the actor doesn't emit", async () => {
    const actor = {
      ...toActorRef({
        send: () => {},
        subscribe: () => {
          return { unsubscribe: () => {} };
        }
      })
    };

    const App = ({ selector }: { selector: any }) => {
      const [, forceRerender] = React.useState(0);
      const value = useSelector(actor, selector);

      return (
        <>
          {value}
          <button
            type="button"
            onClick={() => forceRerender((s) => s + 1)}
          ></button>
        </>
      );
    };

    const { container, rerender } = render(<App selector={() => 'foo'} />);
    expect(container.textContent).toEqual('foo');

    rerender(<App selector={() => 'bar'} />);
    expect(container.textContent).toEqual('bar');

    fireEvent.click(await screen.findByRole('button'));
    expect(container.textContent).toEqual('bar');
  });

  it('should only rerender once when the selected value changes', () => {
    const selector = (state: any) => state.context.foo;

    const machine = createMachine<{ foo: number }, { type: 'INC' }>({
      context: {
        foo: 0
      },
      on: {
        INC: {
          actions: assign({
            foo: (context) => ++context.foo
          })
        }
      }
    });

    const service = interpret(machine).start();

    let renders = 0;

    const App = () => {
      ++renders;
      useSelector(service, selector);

      return null;
    };

    render(<App />);

    // reset
    renders = 0;
    act(() => {
      service.send({ type: 'INC' });
    });

    expect(renders).toBe(suiteKey === 'strict' ? 2 : 1);
  });

  it('should compute a stable snapshot internally when selecting from uninitialized service', () => {
    const child = createMachine({});
    const machine = createMachine({
      invoke: {
        id: 'child',
        src: child
      }
    });

    const snapshots: AnyState[] = [];

    function App() {
      const service = useInterpret(machine);
      useSelector(service, (state) => {
        snapshots.push(state);
        return state.children.child;
      });
      return null;
    }

    console.error = jest.fn();
    render(<App />);

    const [snapshot1] = snapshots;
    expect(snapshots.every((s) => s === snapshot1));
    expect(console.error).toHaveBeenCalledTimes(0);
  });

  it(`shouldn't interfere with spawning actors that are part of the initial state of an actor`, () => {
    let called = false;
    const child = createMachine({
      entry: () => (called = true)
    });
    const machine = createMachine({
      context: () => ({
        childRef: spawn(child)
      })
    });

    function App() {
      const service = useInterpret(machine);
      useSelector(service, () => {});
      expect(called).toBe(false);
      return null;
    }

    render(<App />);

    expect(called).toBe(true);
  });
});
