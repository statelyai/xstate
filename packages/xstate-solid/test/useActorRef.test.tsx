/* @jsxImportSource solid-js */
import { createActor, createMachine } from 'xstate';
import { restoreActor } from 'xstate/persist';
import { render, fireEvent, screen } from '@solidjs/testing-library';
import { useActor, useActorRef } from '../src/index.ts';
import { createEffect } from 'solid-js';

describe('useActorRef', () => {
  it('uses a ready actor as is, starting it on mount and stopping it on unmount', () => {
    const machine = createMachine({
      initial: 'a',
      states: { a: { on: { NEXT: { target: 'b' } } }, b: {} }
    });
    const source = createActor(machine).start();
    source.send({ type: 'NEXT' });
    const actor = restoreActor(machine, source.getPersistedSnapshot());
    source.stop();
    let received: unknown;

    const App = () => {
      const [snapshot, , actorRef] = useActor(actor);
      received = actorRef;
      return <div data-testid="value">{String(snapshot.value)}</div>;
    };

    const { unmount } = render(() => <App />);
    expect(received).toBe(actor);
    expect(screen.getByTestId('value').textContent).toBe('b');
    expect(actor.getSnapshot().status).toBe('active');

    unmount();
    expect(actor.getSnapshot().status).toBe('stopped');
  });

  it('observer should be called with next state', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: { target: 'active' }
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

    return promise;
  });

  it('service should work with from SolidJS utility', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: { target: 'active' }
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

    return promise;
  });
});
