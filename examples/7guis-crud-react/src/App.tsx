import { useActor } from '@xstate/react';
import './App.css';
import { crudMachine, matchesFilter } from './crudMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

function App() {
  const [state, send] = useActor(crudMachine, {
    inspect: inspector.inspect
  });
  const { entries, selectedId, filter, nameDraft, surnameDraft } =
    state.context;
  const visible = entries.filter((entry) => matchesFilter(entry, filter));

  return (
    <section id="app">
      <h1>CRUD</h1>

      <label className="filter">
        Filter prefix
        <input
          value={filter}
          onChange={(event) =>
            send({ type: 'filter', value: event.target.value })
          }
        />
      </label>

      <div className="columns">
        <select
          size={6}
          value={selectedId ?? ''}
          onChange={(event) => send({ type: 'select', id: event.target.value })}
        >
          {visible.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.surname}, {entry.name}
            </option>
          ))}
        </select>

        <div className="fields">
          <label>
            Name
            <input
              value={nameDraft}
              onChange={(event) =>
                send({ type: 'name', value: event.target.value })
              }
            />
          </label>
          <label>
            Surname
            <input
              value={surnameDraft}
              onChange={(event) =>
                send({ type: 'surname', value: event.target.value })
              }
            />
          </label>
        </div>
      </div>

      <div className="toolbar">
        <button onClick={() => send({ type: 'create' })}>Create</button>
        <button disabled={!selectedId} onClick={() => send({ type: 'update' })}>
          Update
        </button>
        <button disabled={!selectedId} onClick={() => send({ type: 'delete' })}>
          Delete
        </button>
      </div>
    </section>
  );
}

export default App;
