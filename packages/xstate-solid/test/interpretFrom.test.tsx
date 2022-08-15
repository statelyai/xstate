/* @jsxImportSource solid-js */
import { createMachine, interpret } from 'xstate';
import { render, fireEvent, screen } from 'solid-testing-library';
import { createEffect, from } from 'solid-js';

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
      const service = interpret(machine).start();
      const serviceState = from(service);

      createEffect(() => {
        expect(serviceState().matches('inactive')).toBeTruthy();
        done();
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
      const service = interpret(machine).start();
      const serviceState = from(service);
      createEffect(() => {
        if (serviceState().matches('active')) {
          done();
        }
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

  it('service should work with from SolidJS utility', (done) => {
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
      const service = interpret(machine).start();
      const serviceState = from(service);

      createEffect(() => {
        if (serviceState().matches('active')) {
          done();
        }
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
