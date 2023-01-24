import * as React from 'react';
import { createMachine } from 'xstate';
import { fireEvent, render } from '@testing-library/react';
import { createActorContext } from '../src/createActorContext';
import { useSelector } from '../src';

describe('createProvider', () => {
  it('should work with useActor', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeContext = createActorContext(someMachine);

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

    const { getByTestId } = render(<App />);

    expect(getByTestId('value').textContent).toBe('a');
  });

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

    const SomeContext = createActorContext(someMachine);

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

    const { getByTestId } = render(<App />);

    expect(getByTestId('value').textContent).toBe('a');

    fireEvent.click(getByTestId('next'));

    expect(getByTestId('value').textContent).toBe('b');
  });

  it('should work with useContext', () => {
    const someMachine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const SomeContext = createActorContext(someMachine);

    const Component = () => {
      const actor = SomeContext.useContext();
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

    const { getByTestId } = render(<App />);

    expect(getByTestId('value').textContent).toBe('a');
  });
});
