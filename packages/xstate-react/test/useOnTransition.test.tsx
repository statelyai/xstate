import * as React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Machine } from 'xstate';
import { useMachine, useOnTransition } from '../src';

describe('useOnTransition hook', () => {
  const machine = Machine({
    id: 'useOnTransition',
    initial: 'a',
    states: {
      a: {
        on: {
          b: 'b'
        }
      },
      b: {
        on: {
          a: 'a'
        }
      }
    }
  });
  interface TestProps {
    onTransition: () => void;
    ignoreInit?: boolean;
  }
  const Test = ({ onTransition, ignoreInit }: TestProps) => {
    const [state, send, service] = useMachine(machine, {
      actions: {
        onTransition
      }
    });

    useOnTransition(onTransition, service, { ignoreInitEvent: !!ignoreInit });

    if (state.matches('a')) {
      return <button onClick={() => send('b')}>go to b</button>;
    }
    if (state.matches('b')) {
      return <button onClick={() => send('a')}>go to a</button>;
    }

    return <> </>;
  };

  beforeEach(cleanup);

  it('calls the function on each state transition and on init', () => {
    const mockOnTransition = jest.fn();
    const { getByText } = render(<Test onTransition={mockOnTransition} />);

    fireEvent.click(getByText(/go to b/i));
    fireEvent.click(getByText(/go to a/i));
    fireEvent.click(getByText(/go to b/i));
    fireEvent.click(getByText(/go to a/i));

    expect(mockOnTransition).toHaveBeenCalledTimes(5);
  });

  it('calls the function on each state transition, but not on init', () => {
    const mockOnTransition = jest.fn();
    const { getByText } = render(
      <Test onTransition={mockOnTransition} ignoreInit={true} />
    );

    fireEvent.click(getByText(/go to b/i));
    fireEvent.click(getByText(/go to a/i));
    fireEvent.click(getByText(/go to b/i));
    fireEvent.click(getByText(/go to a/i));

    expect(mockOnTransition).toHaveBeenCalledTimes(4);
  });
});
