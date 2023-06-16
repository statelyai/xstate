/* @jsxImportSource solid-js */
import { createMachine, fromTransition } from 'xstate';
import { render, fireEvent, screen } from 'solid-testing-library';
import { createActorRef, useSnapshot } from '../src/index.ts';
import { createEffect } from 'solid-js';

describe('createService', () => {
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
      const service = createActorRef(machine);

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
            service.send({ type: 'ACTIVATE' });
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
      const service = createActorRef(machine);

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
            service.send({ type: 'ACTIVATE' });
          }}
        />
      );
    };

    render(() => <App />);
    const button = screen.getByTestId('button');

    fireEvent.click(button);
  });

  it('should be able to spawn an actor from actor logic', () => {
    const reducer = (state: number, event: { type: 'INC' }): number => {
      if (event.type === 'INC') {
        return state + 1;
      }

      return state;
    };

    const Test = () => {
      const actorRef = createActorRef(fromTransition(reducer, 0));
      const count = useSnapshot(() => actorRef);

      return (
        <button
          data-testid="count"
          onclick={() => actorRef.send({ type: 'INC' })}
        >
          {count()}
        </button>
      );
    };

    render(() => <Test />);
    const button = screen.getByTestId('count');

    expect(button.textContent).toEqual('0');

    fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
