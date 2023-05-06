import { createMachine, assign, interpret, fromPromise } from 'xstate';
import { fireEvent, screen, render, waitFor } from '@testing-library/react';
import { useSelector, createActorContext, shallowEqual } from '../src';

const originalConsoleError = console.error;

afterEach(() => {
  console.error = originalConsoleError;
});

describe('createActorContext', () => {
  it('should work with useActor', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeContext = createActorContext(interpret(someMachine));

    const Component = () => {
      const [state] = SomeContext.useActor();

      return <div data-testid="value">{state.value}</div>;
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

  it('should work with useSelector', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeContext = createActorContext(interpret(someMachine));

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

    const SomeContext = createActorContext(interpret(someMachine));

    const Component = () => {
      const [state, send] = SomeContext.useActor();

      return (
        <>
          <div data-testid="value">{state.value}</div>
          <button data-testid="next" onClick={() => send({ type: 'NEXT' })}>
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

    const SomeContext = createActorContext(interpret(someMachine));

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

    const SomeContext = createActorContext(interpret(someMachine));

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

  it('should work with a provided actorRef', () => {
    const createSomeMachine = (context: { count: number }) =>
      createMachine({
        context
      });

    const SomeContext = createActorContext(
      interpret(createSomeMachine({ count: 0 }))
    );

    const Component = () => {
      const actor = SomeContext.useActorRef();
      const count = useSelector(actor, (state) => state.context.count);

      return <div data-testid="value">{count}</div>;
    };

    const otherActor = interpret(createSomeMachine({ count: 42 }));

    const App = () => {
      return (
        <SomeContext.Provider actorRef={otherActor}>
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(screen.getByTestId('value').textContent).toBe('42');
  });

  it('useActorRef should throw when the actor was not provided', () => {
    console.error = jest.fn();
    const SomeContext = createActorContext(interpret(createMachine({})));

    const App = () => {
      SomeContext.useActorRef();
      return null;
    };

    expect(() => render(<App />)).toThrowErrorMatchingInlineSnapshot(
      `"You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component."`
    );
    expect(console.error).toHaveBeenCalledTimes(3);
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: Uncaught [Error: You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component.]],
        ],
        [
          [Error: Uncaught [Error: You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component.]],
        ],
        [
          "The above error occurred in the <App> component:

          at useActorRef (/Users/davidkpiano/Code/xstate/packages/xstate-react/test/createActorContext.test.tsx:256:19)

      Consider adding an error boundary to your tree to customize error handling behavior.
      Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.",
        ],
      ]
    `);
  });

  it('useActor should throw when the actor was not provided', () => {
    console.error = jest.fn();
    const SomeContext = createActorContext(interpret(createMachine({})));

    const App = () => {
      SomeContext.useActor();
      return null;
    };

    expect(() => render(<App />)).toThrowErrorMatchingInlineSnapshot(
      `"You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component."`
    );
    expect(console.error).toHaveBeenCalledTimes(3);
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: Uncaught [Error: You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component.]],
        ],
        [
          [Error: Uncaught [Error: You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component.]],
        ],
        [
          "The above error occurred in the <App> component:

          at useActor (/Users/davidkpiano/Code/xstate/packages/xstate-react/test/createActorContext.test.tsx:289:19)

      Consider adding an error boundary to your tree to customize error handling behavior.
      Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.",
        ],
      ]
    `);
  });

  it('useSelector should throw when the actor was not provided', () => {
    console.error = jest.fn();
    const SomeContext = createActorContext(interpret(createMachine({})));

    const App = () => {
      SomeContext.useSelector((a) => a);
      return null;
    };

    expect(() => render(<App />)).toThrowErrorMatchingInlineSnapshot(
      `"You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component."`
    );
    expect(console.error).toHaveBeenCalledTimes(3);
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: Uncaught [Error: You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component.]],
        ],
        [
          [Error: Uncaught [Error: You used a hook from "ActorProvider(x:0)" but it's not inside a <ActorProvider(x:0)> component.]],
        ],
        [
          "The above error occurred in the <App> component:

          at useSelector (/Users/davidkpiano/Code/xstate/packages/xstate-react/test/createActorContext.test.tsx:322:19)

      Consider adding an error boundary to your tree to customize error handling behavior.
      Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.",
        ],
      ]
    `);
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
    const SomeContext = createActorContext(interpret(someMachine));

    const Component = () => {
      return null;
    };

    const App = () => {
      return (
        <SomeContext.Provider
          actorRef={() =>
            interpret(
              someMachine.provide({
                actions: {
                  testAction: stubFn
                }
              })
            )
          }
        >
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    expect(stubFn).toHaveBeenCalledTimes(1);
  });

  it('should work with any actor', async () => {
    const somePromiseActor = interpret(
      fromPromise(() => Promise.resolve(42))
    ).start();

    const SomeContext = createActorContext(somePromiseActor);

    const Component = () => {
      const count = SomeContext.useSelector((s) => s);

      return <div data-testid="value">{count}</div>;
    };

    const App = () => {
      return (
        <SomeContext.Provider>
          <Component />
        </SomeContext.Provider>
      );
    };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('42');
    });
  });
});
