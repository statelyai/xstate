import { useActor } from '@xstate/react';
import './App.css';
import { searchMachine } from './searchMachine';

function App() {
  const [state, send] = useActor(searchMachine);
  const { query, results, highlighted, selected, errorMessage } = state.context;

  return (
    <main className="app">
      <h1>Search autocomplete</h1>

      <input
        type="text"
        value={query}
        placeholder="Try “state”, or “err” to fail"
        aria-expanded={state.matches('results')}
        onChange={(event) =>
          send({ type: 'QUERY_CHANGED', query: event.target.value })
        }
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            send({ type: 'HIGHLIGHT_NEXT' });
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            send({ type: 'HIGHLIGHT_PREV' });
          } else if (event.key === 'Enter') {
            send({ type: 'CHOOSE' });
          } else if (event.key === 'Escape') {
            send({ type: 'DISMISS' });
          }
        }}
      />

      {state.matches('debouncing') && <p className="state">Waiting…</p>}
      {state.matches('searching') && <p className="state">Searching…</p>}
      {state.matches('noResults') && <p className="state">No results</p>}
      {state.matches('error') && <p className="state error">{errorMessage}</p>}
      {state.matches('chosen') && <p className="state">Chose: {selected}</p>}

      {state.matches('results') && (
        <ul className="results" role="listbox">
          {results.map((result, i) => (
            <li
              key={result}
              role="option"
              aria-selected={i === highlighted}
              className={i === highlighted ? 'current' : undefined}
            >
              {result}
            </li>
          ))}
        </ul>
      )}

      <p className="state">state: {JSON.stringify(state.value)}</p>
    </main>
  );
}

export default App;
