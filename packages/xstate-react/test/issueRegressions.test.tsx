/**
 * Regression tests for open @xstate/react issues that are fixed in v6. Each
 * test reproduces the issue as originally reported with v6 APIs.
 */
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import {
  createActor,
  createCallbackLogic,
  createMachine,
  setup,
  types
} from 'xstate';
import { useMachine } from '../src/index.ts';

describe('lifecycle', () => {
  it('#5272 an invoked callback starts once under StrictMode', () => {
    let starts = 0;
    let cleanups = 0;
    const appMachine = createMachine({
      invoke: {
        src: createCallbackLogic(() => {
          starts++;
          return () => {
            cleanups++;
          };
        })
      }
    });

    function App() {
      useMachine(appMachine);
      return null;
    }

    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    expect(starts).toBe(1);
    expect(cleanups).toBe(0);
  });

  it('#5074 system.get resolves a sibling invoked actor under StrictMode', () => {
    const results: string[] = [];
    const feedbackMachine = createMachine({});
    const rootMachine = setup({
      actors: {
        feedback: feedbackMachine,
        alert: createCallbackLogic(({ system }) => {
          results.push(system.get('feedback') ? 'ok' : 'missing');
        })
      }
    }).createMachine({
      invoke: [{ src: 'feedback', registryKey: 'feedback' }, { src: 'alert' }]
    });

    function App() {
      useMachine(rootMachine);
      return null;
    }

    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results).not.toContain('missing');
  });

  it('#3270 an event sent from a callback ref survives the StrictMode remount', () => {
    const counterMachine = createMachine({
      schemas: {
        events: { INCREMENT: types<{}>() }
      },
      context: { count: 0 },
      on: {
        INCREMENT: ({ context }) => ({
          context: { count: context.count + 1 }
        })
      }
    });

    function Counter() {
      const [current, send] = useMachine(counterMachine);
      const ref = React.useCallback(
        (node: HTMLElement | null) => {
          if (node) {
            send({ type: 'INCREMENT' });
          }
        },
        [send]
      );
      return <div ref={ref}>count: {current.context.count}</div>;
    }

    render(
      <React.StrictMode>
        <Counter />
      </React.StrictMode>
    );

    // React 19 invokes the callback ref twice under StrictMode
    expect(screen.getByText(/count:/).textContent).toBe('count: 2');
  });
});

describe('types', () => {
  it('#5480 useMachine accepts persisted and live snapshots', () => {
    const machine = createMachine({
      initial: 'a',
      states: { a: { on: { NEXT: { target: 'b' } } }, b: {} }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });
    const persisted = actor.getPersistedSnapshot();
    const live = actor.getSnapshot();
    const fromStorage = JSON.parse(JSON.stringify(persisted));

    function App() {
      const [a] = useMachine(machine, { snapshot: persisted });
      const [b] = useMachine(machine, { snapshot: live });
      const [c] = useMachine(machine, { snapshot: fromStorage });
      return (
        <div data-testid="values">{[a.value, b.value, c.value].join(',')}</div>
      );
    }

    render(<App />);

    expect(screen.getByTestId('values').textContent).toBe('b,b,b');
  });
});
