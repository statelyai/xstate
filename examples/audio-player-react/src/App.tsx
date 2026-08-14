import { useActor } from '@xstate/react';
import './App.css';
import { playlistMachine, tracks } from './playlistMachine';

function App() {
  const [state, send] = useActor(playlistMachine);
  const { index, elapsed, shuffle } = state.context;
  const track = tracks[index];

  return (
    <main className="app">
      <h1>Audio player</h1>

      <ol className="tracks">
        {tracks.map((item, i) => (
          <li key={item.id} className={i === index ? 'current' : undefined}>
            <button onClick={() => send({ type: 'SELECT', index: i })}>
              {item.title}
            </button>
            <span className="state">{item.artist}</span>
          </li>
        ))}
      </ol>

      <p>
        <strong>{track.title}</strong> — {elapsed}s / {track.duration}s
      </p>

      <div className="row">
        <button onClick={() => send({ type: 'PREV' })}>Prev</button>
        {state.matches('playing') ? (
          <button onClick={() => send({ type: 'PAUSE' })}>Pause</button>
        ) : (
          <button onClick={() => send({ type: 'PLAY' })}>Play</button>
        )}
        <button onClick={() => send({ type: 'NEXT' })}>Next</button>
        <label className="row">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={() => send({ type: 'TOGGLE_SHUFFLE' })}
          />
          Shuffle
        </label>
      </div>

      <p className="state">state: {JSON.stringify(state.value)}</p>
    </main>
  );
}

export default App;
