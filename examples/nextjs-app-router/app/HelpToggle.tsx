'use client';

import { useMachine } from '@xstate/react';
import { setup, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

/**
 * A local UI machine, running in the browser with `@xstate/react`. It never
 * touches the server: the checkout machine above is the server's business,
 * this one is just interface state.
 */
const helpMachine = setup({
  schemas: {
    events: { toggle: types<{}>() }
  }
}).createMachine({
  id: 'help',
  initial: 'hidden',
  states: {
    hidden: { on: { toggle: { target: 'shown' } } },
    shown: { on: { toggle: { target: 'hidden' } } }
  }
});

export function HelpToggle() {
  const [snapshot, send] = useMachine(helpMachine, {
    inspect: inspector.inspect
  });

  return (
    <section>
      <button type="button" onClick={() => send({ type: 'toggle' })}>
        {snapshot.matches('shown') ? 'Hide help' : 'Show help'}
      </button>
      {snapshot.matches('shown') && (
        <p>
          The buttons above post to a server action, which advances the checkout
          machine stored against your session cookie. This panel is a separate
          client-side machine.
        </p>
      )}
    </section>
  );
}
