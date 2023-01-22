import * as React from 'react';
import { createMachine } from 'xstate';
import { render } from '@testing-library/react';
import { createProvider } from '../src/createProvider';
import { useSelector } from '../src';

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
