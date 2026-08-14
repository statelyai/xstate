import { useMachine } from '@xstate/solid';
import { createInspector } from '@statelyai/sdk';
import { toggleMachine } from './toggleMachine';

const inspector = createInspector();

export default function App() {
  // `snapshot` is a Solid store, so reads inside JSX are fine-grained: only the
  // text nodes that depend on a changed value update.
  const [snapshot, send] = useMachine(toggleMachine, {
    inspect: inspector.inspect
  });

  return (
    <main>
      <h1>Toggle</h1>

      <button
        classList={{ toggle: true, on: snapshot.matches('on') }}
        onClick={() => send({ type: 'toggle' })}
      >
        {snapshot.matches('on') ? 'On' : 'Off'}
      </button>

      <p class="count">Turned on {snapshot.context.onCount} times.</p>
    </main>
  );
}
