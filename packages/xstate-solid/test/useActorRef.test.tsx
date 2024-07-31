/* @jsxImportSource solid-js */
import { createMachine } from 'xstate';
import { render, fireEvent, screen } from 'solid-testing-library';
import { useActorRef } from '../src/index.ts';
import { createEffect } from 'solid-js';

describe('useActorRef', () => {
  it('observer should be called with next state', () =>
    new Promise<void>((resolve) => {
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
        const service = useActorRef(machine);

        createEffect(() => {
          service.subscribe((state) => {
            if (state.matches('active')) {
              resolve();
            }
          });
        });

        return (
          <button
            data-testid="button"
            onclick={() => {
              service.send({ type: 'ACTIVATE' });
            }}
          />
        );
      };

      render(() => <App />);
      const button = screen.getByTestId('button');

      fireEvent.click(button);
    }));

  it('service should work with from SolidJS utility', () =>
    new Promise<void>((resolve) => {
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
        const service = useActorRef(machine);

        createEffect(() => {
          service.subscribe((state) => {
            if (state.matches('active')) {
              resolve();
            }
          });
        });

        return (
          <button
            data-testid="button"
            onclick={() => {
              service.send({ type: 'ACTIVATE' });
            }}
          />
        );
      };

      render(() => <App />);
      const button = screen.getByTestId('button');

      fireEvent.click(button);
    }));
});
