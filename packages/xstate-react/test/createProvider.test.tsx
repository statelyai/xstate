import * as React from 'react';
import { createMachine, assign } from 'xstate';
import { fireEvent, screen, render } from '@testing-library/react';
import { createProvider } from '../src/createProvider';
import { shallowEqual, useSelector } from '../src';

describe('createProvider', () => {
  it('should work with useActor', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeProvider = createProvider(someMachine);

    const Component = () => {
      const [state] = SomeProvider.useActor();

      return <div data-testid="value">{state.value}</div>;
    };

    const App = () => {
      return (
        <SomeProvider>
          <Component />
        </SomeProvider>
      );
    };

    const { getByTestId } = render(<App />);

    expect(getByTestId('value').textContent).toBe('a');
  });

  it('should work with useSelector', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeProvider = createProvider(someMachine);

    const Component = () => {
      const value = SomeProvider.useSelector((state) => state.value);

      return <div data-testid="value">{value}</div>;
    };

    const App = () => {
      return (
        <SomeProvider>
          <Component />
        </SomeProvider>
      );
    };

    const { getByTestId } = render(<App />);

    expect(getByTestId('value').textContent).toBe('a');
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

    const SomeProvider = createProvider(someMachine);

    const Component = () => {
      const [state, send] = SomeProvider.useActor();

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
        <SomeProvider>
          <Component />
        </SomeProvider>
      );
    };

    const { getByTestId } = render(<App />);

    expect(getByTestId('value').textContent).toBe('a');

    fireEvent.click(getByTestId('next'));

    expect(getByTestId('value').textContent).toBe('b');
  });

  it('should work with useSelector and a custom comparator', async () => {
    interface SomeContext {
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
        arr: []
      },
      on: {
        INC: {
          actions: assign<SomeContext>((ctx) => ({
            obj: {
              counter: ctx.obj.counter + 1
            }
          }))
        },
        PUSH: {
          actions: assign<SomeContext>((ctx) => ({
            arr: [...ctx.arr, Math.random().toString(36).slice(2)]
          }))
        }
      }
    });

    const SomeProvider = createProvider(someMachine);

    let rerenders = 0;

    const Component = () => {
      const actor = SomeProvider.useContext();
      const value = SomeProvider.useSelector(
        (state: any) => state.context.obj,
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
        <SomeProvider>
          <Component />
        </SomeProvider>
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

  it('should work with useContext', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeProvider = createProvider(someMachine);

    const Component = () => {
      const actor = SomeProvider.useContext();
      const value = useSelector(actor, (state) => state.value);

      return <div data-testid="value">{value}</div>;
    };

    const App = () => {
      return (
        <SomeProvider>
          <Component />
        </SomeProvider>
      );
    };

    const { getByTestId } = render(<App />);

    expect(getByTestId('value').textContent).toBe('a');
  });
});
