import * as React from 'react';
import { assign, createMachine, interpret, spawn, toActorRef } from 'xstate';
import { act, render, cleanup, fireEvent } from '@testing-library/react';
import { useInterpret, useMachine, useSelector } from '../src';

afterEach(cleanup);

describe('useSelector', () => {
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

    const { getByTestId } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    const countButton = getByTestId('count');
    const otherButton = getByTestId('other');
    const incrementEl = getByTestId('increment');

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

    const { getByTestId } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    const nameEl = getByTestId('name');
    const sendUpperButton = getByTestId('sendUpper');
    const sendOtherButton = getByTestId('sendOther');

    expect(nameEl.textContent).toEqual('david');

    fireEvent.click(sendUpperButton);

    // unchanged due to comparison function
    expect(nameEl.textContent).toEqual('david');

    fireEvent.click(sendOtherButton);

    expect(nameEl.textContent).toEqual('other');

    fireEvent.click(sendUpperButton);

    expect(nameEl.textContent).toEqual('DAVID');
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
      entry: assign({
        childActor: () => spawn(childMachine)
      })
    });

    const selector = (state) => state.context.count;

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

    const { getByTestId } = render(<App />);

    const buttonEl = getByTestId('button');
    const countEl = getByTestId('count');

    expect(countEl.textContent).toEqual('0');
    fireEvent.click(buttonEl);
    expect(countEl.textContent).toEqual('1');
  });

  // doesn't work because initially the actor is "deferred"
  it.skip('should render custom snapshot of initially spawned custom actor', () => {
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
      entry: assign({
        childActor: () => spawn(createActor('foo'))
      })
    });

    const identitySelector = (value: any) => value;
    const getSnapshot = (actor: ReturnType<typeof createActor>) =>
      actor.latestValue;

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

    const { getByTestId, getByRole, rerender } = render(<App prop="first" />);

    const buttonEl = getByRole('button');
    const valueEl = getByTestId('value');

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
      entry: assign({
        childActor: () => spawn(createActor('foo'))
      })
    });

    const identitySelector = (value: any) => value;
    const getSnapshot = (actor: ReturnType<typeof createActor>) =>
      actor.latestValue;

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

    const { container, rerender, findByRole } = render(
      <App selector={() => 'foo'} />
    );
    expect(container.textContent).toEqual('foo');

    rerender(<App selector={() => 'bar'} />);
    expect(container.textContent).toEqual('bar');

    fireEvent.click(await findByRole('button'));
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

    expect(renders).toBe(1);
  });
});
