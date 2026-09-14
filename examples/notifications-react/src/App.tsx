import { useActor } from '@xstate/react';
import './App.css';
import { notificationsMachine } from './notificationsMachine';
import { ToastKind } from './toastMachine';
import { Toast } from './Toast';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const messages: Record<ToastKind, string> = {
  info: 'Sync finished.',
  success: 'Invite sent.',
  error: 'Upload failed. Try again.'
};

function App() {
  const [state, send] = useActor(notificationsMachine, {
    inspect: inspector.inspect
  });
  const { visible, queue } = state.context;

  return (
    <section id="app">
      <h1>Toast queue</h1>
      <p>
        At most three toasts are shown at once; the rest wait in the parent's
        queue. Hover a toast to pause its timer.
      </p>

      <div className="controls">
        {(Object.keys(messages) as ToastKind[]).map((kind) => (
          <button
            key={kind}
            className={kind}
            onClick={() =>
              send({ type: 'push', kind, message: messages[kind] })
            }
          >
            Push {kind}
          </button>
        ))}
      </div>

      <p className="meta">
        visible: {visible.length} · queued: {queue.length}
      </p>

      <div className="toasts">
        {visible.map((toastRef) => (
          <Toast key={toastRef.id} toastRef={toastRef} />
        ))}
      </div>
    </section>
  );
}

export default App;
