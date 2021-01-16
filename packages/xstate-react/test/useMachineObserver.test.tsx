import * as React from 'react';
import { createMachine } from 'xstate';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useMachineObserver } from '../src/useMachine';

afterEach(cleanup);

describe('useMachineObserver', () => {
  it('observer should be called with initial state', (done) => {
    const machine = createMachine({
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
      useMachineObserver(machine, {}, (state) => {
        expect(state.matches('inactive')).toBeTruthy();
        done();
      });

      return null;
    };

    render(<App />);
  });

  it('observer should be called with next state', (done) => {
    const machine = createMachine({
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
      const service = useMachineObserver(machine, {}, (state) => {
        if (state.matches('active')) {
          done();
        }
      });

      return (
        <button
          data-testid="button"
          onClick={() => {
            service.send('ACTIVATE');
          }}
        ></button>
      );
    };

    const { getByTestId } = render(<App />);
    const button = getByTestId('button');

    fireEvent.click(button);
  });
});
