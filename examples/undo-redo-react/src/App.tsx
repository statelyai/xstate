import { useActor } from '@xstate/react';
import './App.css';
import { editorMachine } from './editorMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

function App() {
  const [state, send] = useActor(editorMachine, {
    inspect: inspector.inspect
  });
  const { past, present, future } = state.context;

  return (
    <section id="app">
      <h1>Undo / redo with grouped edits</h1>

      <textarea
        value={present}
        rows={6}
        placeholder="Type here, then pause for a moment…"
        onChange={(event) => send({ type: 'type', value: event.target.value })}
      />

      <div className="toolbar">
        <button disabled={!past.length} onClick={() => send({ type: 'undo' })}>
          Undo
        </button>
        <button
          disabled={!future.length}
          onClick={() => send({ type: 'redo' })}
        >
          Redo
        </button>
        <span className={`status ${state.matches('editing') ? 'busy' : ''}`}>
          {state.matches('editing')
            ? 'editing — commits after a pause'
            : 'idle — next keystroke starts a new entry'}
        </span>
      </div>

      <div className="stacks">
        <div>
          <h2>past ({past.length})</h2>
          <ol>
            {past.map((entry, index) => (
              <li key={index}>
                <code>{entry || '∅'}</code>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2>future ({future.length})</h2>
          <ol>
            {future.map((entry, index) => (
              <li key={index}>
                <code>{entry || '∅'}</code>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default App;
