import { useActor } from '@xstate/react';
import './App.css';
import { COLUMNS, ROWS, cellsMachine } from './cellsMachine';

function App() {
  const [state, send] = useActor(cellsMachine);
  const { values, editing, draft } = state.context;

  return (
    <section id="app">
      <h1>Cells</h1>
      <p className="hint">
        Double-click a cell to edit. Formulas start with <code>=</code>, e.g.{' '}
        <code>=A1+A2*2</code> or <code>=SUM(A1:B2)</code>.
      </p>

      <table>
        <thead>
          <tr>
            <th />
            {COLUMNS.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row}>
              <th>{row}</th>
              {COLUMNS.map((column) => {
                const cell = `${column}${row}`;

                return (
                  <td
                    key={cell}
                    onDoubleClick={() => send({ type: 'edit', cell })}
                  >
                    {editing === cell ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(event) =>
                          send({ type: 'draft', value: event.target.value })
                        }
                        onBlur={() => send({ type: 'commit' })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            send({ type: 'commit' });
                          } else if (event.key === 'Escape') {
                            send({ type: 'cancel' });
                          }
                        }}
                      />
                    ) : (
                      (values[cell] ?? '')
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default App;
