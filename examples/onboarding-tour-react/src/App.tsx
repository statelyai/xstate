import { useState } from 'react';
import { useActor } from '@xstate/react';
import { tourMachine, steps, STORAGE_KEY } from './tourMachine';

function Tour({ onReset }: { onReset: () => void }) {
  const [state, send] = useActor(tourMachine);

  const running = state.matches('running');
  const step = steps[state.context.step];
  const highlighted = running ? step.target : null;

  const spot = (target: string) =>
    highlighted === target ? 'spotlight' : undefined;

  return (
    <main>
      <h1>Acme Dashboard</h1>

      <div className="mock">
        <nav className={spot('sidebar')}>
          <strong>Projects</strong>
          <ul>
            <li>Website</li>
            <li>Mobile app</li>
          </ul>
        </nav>
        <section className="panel">
          <input className={spot('search')} placeholder="Search…" readOnly />
          <div className="row">
            <button className={spot('save')}>Save</button>
            <div className={`avatar ${spot('avatar') ?? ''}`}>AL</div>
          </div>
        </section>
      </div>

      {running && (
        <div className="callout">
          <p className="hint">
            Step {state.context.step + 1} of {steps.length}
          </p>
          <h2>{step.title}</h2>
          <p>{step.body}</p>
          <div className="row">
            <button
              onClick={() => send({ type: 'prev' })}
              disabled={state.context.step === 0}
            >
              Back
            </button>
            <button onClick={() => send({ type: 'next' })}>
              {state.context.step === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
            {state.matches({ running: 'playing' }) ? (
              <button onClick={() => send({ type: 'pause' })}>Pause</button>
            ) : (
              <button onClick={() => send({ type: 'resume' })}>Resume</button>
            )}
            <button onClick={() => send({ type: 'skip' })}>Skip tour</button>
          </div>
        </div>
      )}

      {state.matches('done') && <p className="ok">Tour complete.</p>}
      {state.matches('skipped') && <p className="hint">Tour skipped.</p>}
      {state.matches('idle') && (
        <p className="hint">You already finished this tour.</p>
      )}

      <button onClick={onReset}>Reset tour</button>
    </main>
  );
}

export default function App() {
  const [run, setRun] = useState(0);

  // Clearing the flag and remounting restarts the machine from `checking`.
  return (
    <Tour
      key={run}
      onReset={() => {
        localStorage.removeItem(STORAGE_KEY);
        setRun((n) => n + 1);
      }}
    />
  );
}
