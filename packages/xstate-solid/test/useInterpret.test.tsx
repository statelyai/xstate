/* @jsxImportSource solid-js */
import { createMachine } from 'xstate';
import { render, cleanup, fireEvent, screen } from 'solid-testing-library';
import { useInterpret } from '../src';
import { createEffect, onMount } from 'solid-js';

// tslint:disable-next-line:no-console
const originalConsoleWarn = console.warn;

afterEach(() => {
  cleanup();
  // tslint:disable-next-line:no-console
  console.warn = originalConsoleWarn;
});

describe('useInterpret', () => {
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
      const service = useInterpret(machine);

      onMount(() => {
        service.subscribe((state) => {
          expect(state.matches('inactive')).toBeTruthy();
          done();
        });
      });

      return null;
    };

    render(() => <App />);
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
      const service = useInterpret(machine);

      createEffect(() => {
        service.subscribe((state) => {
          if (state.matches('active')) {
            done();
          }
        });
      });

      return (
        <button
          data-testid="button"
          onclick={() => {
            service.send('ACTIVATE');
          }}
        />
      );
    };

    render(() => <App />);
    const button = screen.getByTestId('button');

    fireEvent.click(button);
  });
});
