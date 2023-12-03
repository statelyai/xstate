import { createMachine, assign, fromPromise, Snapshot } from 'xstate';
import { fireEvent, screen, render, waitFor } from '@testing-library/react';
import { useSelector, createActorContext, shallowEqual } from '../src';

const originalConsoleError = console.error;

afterEach(() => {
  console.error = originalConsoleError;
});

function checkConsoleErrorOutputForMissingProvider() {
  expect(console.error).toHaveBeenCalledTimes(3);
  expect((console.error as any).mock.calls[0][0].message.split('\n')[0]).toBe(
    `Uncaught [Error: You used a hook from \"ActorProvider\" but it's not inside a <ActorProvider> component.]`
  );
  expect((console.error as any).mock.calls[1][0].message.split('\n')[0]).toBe(
    `Uncaught [Error: You used a hook from \"ActorProvider\" but it's not inside a <ActorProvider> component.]`
  );
  expect((console.error as any).mock.calls[2][0].split('\n')[0]).toBe(
    `The above error occurred in the <App> component:`
  );
}

describe('createActorContext', () => {
  it('should work with useSelector', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeContext = createActorContext(someMachine);

    const Component = () => {
      const value = SomeContext.useSelector((state) => state.value);

      return <div data-testid="value">{value}</div>;
    };

    const App = () => {
      return (
        <SomeContext.Provider>
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(screen.getByTestId('value').textContent).toBe('a');
  });

  it('the actor should be able to receive events', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {}
      }
    });

    const SomeContext = createActorContext(someMachine);

    const Component = () => {
      const actorRef = SomeContext.useActorRef();
      const state = SomeContext.useSelector((s) => s);

      return (
        <>
          <div data-testid="value">{state.value}</div>
          <button
            data-testid="next"
            onClick={() => actorRef.send({ type: 'NEXT' })}
          >
            Next
          </button>
        </>
      );
    };

    const App = () => {
      return (
        <SomeContext.Provider>
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(screen.getByTestId('value').textContent).toBe('a');

    fireEvent.click(screen.getByTestId('next'));

    expect(screen.getByTestId('value').textContent).toBe('b');
  });

  it('should work with useSelector and a custom comparator', async () => {
    interface MachineContext {
      obj: {
        counter: number;
      };
      arr: string[];
    }
    const someMachine = createMachine({
      context: {
        obj: {
          counter: 0
        },
        arr: [] as string[]
      },
      on: {
        INC: {
          actions: assign<MachineContext>(({ context }) => ({
            obj: {
              counter: context.obj.counter + 1
            }
          }))
        },
        PUSH: {
          actions: assign<MachineContext>(({ context }) => ({
            arr: [...context.arr, Math.random().toString(36).slice(2)]
          }))
        }
      }
    });

    const SomeContext = createActorContext(someMachine);

    let rerenders = 0;

    const Component = () => {
      const actor = SomeContext.useActorRef();
      const value = SomeContext.useSelector(
        (state) => state.context.obj,
        shallowEqual
      );

      rerenders += 1;

      return (
        <>
          <button onClick={() => actor.send({ type: 'INC' })}>Inc</button>
          <button onClick={() => actor.send({ type: 'PUSH' })}>Push</button>
          <div data-testid="value">{value.counter}</div>;
        </>
      );
    };

    const App = () => {
      return (
        <SomeContext.Provider>
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(screen.getByTestId('value').textContent).toBe('0');
    expect(rerenders).toBe(1);

    fireEvent.click(screen.getByText('Inc'));

    expect(screen.getByTestId('value').textContent).toBe('1');
    expect(rerenders).toBe(2);

    fireEvent.click(screen.getByText('Push'));

    expect(rerenders).toBe(2);

    fireEvent.click(screen.getByText('Inc'));

    expect(screen.getByTestId('value').textContent).toBe('2');
    expect(rerenders).toBe(3);
  });

  it('should work with useActorRef', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeContext = createActorContext(someMachine);

    const Component = () => {
      const actor = SomeContext.useActorRef();
      const value = useSelector(actor, (state) => state.value);

      return <div data-testid="value">{value}</div>;
    };

    const App = () => {
      return (
        <SomeContext.Provider>
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(screen.getByTestId('value').textContent).toBe('a');
  });

  it('should work with a provided machine', () => {
    const createSomeMachine = (context: { count: number }) =>
      createMachine({
        context
      });

    const SomeContext = createActorContext(createSomeMachine({ count: 0 }));

    const Component = () => {
      const actor = SomeContext.useActorRef();
      const count = useSelector(actor, (state) => state.context.count);

      return <div data-testid="value">{count}</div>;
    };

    const otherMachine = createSomeMachine({ count: 42 });

    const App = () => {
      return (
        <SomeContext.Provider logic={otherMachine}>
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(screen.getByTestId('value').textContent).toBe('42');
  });

  it('useActorRef should throw when the actor was not provided', () => {
    console.error = jest.fn();
    const SomeContext = createActorContext(createMachine({}));

    const App = () => {
      SomeContext.useActorRef();
      return null;
    };

    expect(() => render(<App />)).toThrowErrorMatchingInlineSnapshot(
      `"You used a hook from "ActorProvider" but it's not inside a <ActorProvider> component."`
    );
    checkConsoleErrorOutputForMissingProvider();
  });

  it('useSelector should throw when the actor was not provided', () => {
    console.error = jest.fn();
    const SomeContext = createActorContext(createMachine({}));

    const App = () => {
      SomeContext.useSelector((a) => a);
      return null;
    };

    expect(() => render(<App />)).toThrowErrorMatchingInlineSnapshot(
      `"You used a hook from "ActorProvider" but it's not inside a <ActorProvider> component."`
    );
    checkConsoleErrorOutputForMissingProvider();
  });

  it('should be able to pass interpreter options to the provider', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: ['testAction']
        }
      }
    });
    const stubFn = jest.fn();
    const SomeContext = createActorContext(someMachine);

    const Component = () => {
      return null;
    };

    const App = () => {
      return (
        <SomeContext.Provider
          logic={someMachine.provide({
            actions: {
              testAction: stubFn
            }
          })}
        >
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(stubFn).toHaveBeenCalledTimes(1);
  });

  it('should work with other types of logic', async () => {
    const PromiseContext = createActorContext(
      fromPromise(() => Promise.resolve(42))
    );

    const Component = () => {
      const value = PromiseContext.useSelector((data) => data);

      return <div data-testid="value">{value.output}</div>;
    };

    const App = () => {
      return (
        <PromiseContext.Provider>
          <Component />
        </PromiseContext.Provider>
      );
    };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('42');
    });
  });

  it("should preserve machine's identity when swapping options using in-render `.provide`", () => {
    const someMachine = createMachine({
      context: { count: 0 },
      on: {
        inc: {
          actions: assign({ count: ({ context }) => context.count + 1 })
        }
      }
    });
    const stubFn = jest.fn();
    const SomeContext = createActorContext(someMachine);

    const Component = () => {
      const { send } = SomeContext.useActorRef();
      const count = SomeContext.useSelector((state) => state.context.count);
      return (
        <>
          <span data-testid="count">{count}</span>
          <button data-testid="button" onClick={() => send({ type: 'inc' })}>
            Inc
          </button>
        </>
      );
    };

    const App = () => {
      return (
        <SomeContext.Provider
          logic={someMachine.provide({
            actions: {
              testAction: stubFn
            }
          })}
        >
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(screen.getByTestId('count').textContent).toBe('0');
    fireEvent.click(screen.getByTestId('button'));

    expect(screen.getByTestId('count').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('button'));

    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('options can be passed to the provider', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            next: 'b'
          }
        },
        b: {}
      }
    });
    const SomeContext = createActorContext(machine);
    let persistedState: Snapshot<unknown> | undefined = undefined;

    const Component = () => {
      const actorRef = SomeContext.useActorRef();
      const state = SomeContext.useSelector((state) => state);

      persistedState = actorRef.getPersistedSnapshot();

      return (
        <div
          data-testid="value"
          onClick={() => {
            actorRef.send({ type: 'next' });
          }}
        >
          {state.value}
        </div>
      );
    };

    const App = () => {
      return (
        <SomeContext.Provider options={{ snapshot: persistedState }}>
          <Component />
        </SomeContext.Provider>
      );
    };

    const { unmount } = render(<App />);

    expect(screen.getByTestId('value').textContent).toBe('a');

    fireEvent.click(screen.getByTestId('value'));

    // Ensure that the state machine without restored state functions as normal
    expect(screen.getByTestId('value').textContent).toBe('b');

    // unrender app
    unmount();

    // At this point, `state` should be `{ value: 'b' }`

    // re-render app
    render(<App />);

    // Ensure that the state machine is restored to the persisted state
    expect(screen.getByTestId('value').textContent).toBe('b');
  });

  it('input can be passed to the provider', () => {
    const SomeContext = createActorContext(
      createMachine({
        types: {} as {
          context: { doubled: number };
        },
        context: ({ input }: { input: number }) => ({
          doubled: input * 2
        })
      })
    );

    const Component = () => {
      const doubled = SomeContext.useSelector((state) => state.context.doubled);

      return <div data-testid="value">{doubled}</div>;
    };

    const App = () => {
      return (
        <SomeContext.Provider options={{ input: 42 }}>
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(screen.getByTestId('value').textContent).toBe('84');
  });
});
