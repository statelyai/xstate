import { useActor } from '@xstate/react';
import './App.css';
import { videoMachine } from './videoMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const format = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function App() {
  const [state, send] = useActor(videoMachine, {
    inspect: inspector.inspect
  });
  const { currentTime, duration } = state.context;

  return (
    <main className="app">
      <h1>Video player</h1>

      <div className="screen">
        {state.matches('loading') && <span>Loading metadata…</span>}
        {state.matches({ ready: 'buffering' }) && <span>Buffering…</span>}
        {state.matches({ ready: 'ended' }) && <span>Ended</span>}
        {state.matches({ ready: 'playing' }) && <span>▶︎ Playing</span>}
        {state.matches({ ready: 'paused' }) && <span>❚❚ Paused</span>}
      </div>

      <input
        type="range"
        min={0}
        max={duration}
        value={currentTime}
        disabled={state.matches('loading')}
        onChange={(event) =>
          send({ type: 'SEEK', time: Number(event.target.value) })
        }
      />
      <div className="state">
        {format(currentTime)} / {format(duration)}
      </div>

      <div className="row">
        <button
          onClick={() => send({ type: 'PLAY' })}
          disabled={!state.can({ type: 'PLAY' })}
        >
          Play
        </button>
        <button
          onClick={() => send({ type: 'PAUSE' })}
          disabled={!state.can({ type: 'PAUSE' })}
        >
          Pause
        </button>
        <button
          onClick={() => send({ type: 'STALL' })}
          disabled={!state.can({ type: 'STALL' })}
        >
          Simulate buffering
        </button>
        <button
          onClick={() => send({ type: 'REPLAY' })}
          disabled={!state.can({ type: 'REPLAY' })}
        >
          Replay
        </button>
      </div>

      <p className="state">state: {JSON.stringify(state.value)}</p>
    </main>
  );
}

export default App;
