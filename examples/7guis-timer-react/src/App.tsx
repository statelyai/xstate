import { useActor } from '@xstate/react';
import './App.css';
import { MAX_DURATION, MIN_DURATION, timerMachine } from './timerMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const seconds = (ms: number) => (ms / 1000).toFixed(1);

function App() {
  const [state, send] = useActor(timerMachine, {
    inspect: inspector.inspect
  });
  const { elapsed, duration } = state.context;
  const progress = duration === 0 ? 1 : Math.min(elapsed / duration, 1);

  return (
    <section id="app">
      <h1>Timer</h1>

      <label>
        Elapsed time
        <progress value={progress} />
      </label>

      <output>{seconds(elapsed)}s</output>

      <label>
        Duration
        <input
          type="range"
          min={MIN_DURATION}
          max={MAX_DURATION}
          step={100}
          value={duration}
          onChange={(event) =>
            send({ type: 'setDuration', duration: event.target.valueAsNumber })
          }
        />
      </label>
      <span className="hint">{seconds(duration)}s</span>

      <button onClick={() => send({ type: 'reset' })}>Reset</button>

      <span className="status">
        {state.matches('running') ? 'running' : 'done — timer stopped'}
      </span>
    </section>
  );
}

export default App;
