import { useMachine } from '@xstate/react';
import { createInspector } from '@statelyai/sdk';
import { bookingMachine } from './bookingMachine';
import './App.css';

const inspector = createInspector();

function App() {
  const [state, send] = useMachine(bookingMachine, {
    inspect: inspector.inspect
  });
  const { slots, selectedId, secondsLeft, confirmation, error } = state.context;

  if (state.matches('booked')) {
    return (
      <section id="app">
        <h1>Booked</h1>
        <p>Confirmation: {confirmation}</p>
        <button onClick={() => send({ type: 'reset' })}>Book another</button>
      </section>
    );
  }

  return (
    <section id="app">
      <h1>Pick a time</h1>
      {state.matches('loading') && <p>Loading slots…</p>}
      {error && <p className="error">{error}</p>}
      <ul className="slots">
        {slots.map((slot) => (
          <li key={slot.id}>
            <button
              className={slot.id === selectedId ? 'selected' : ''}
              disabled={slot.taken || !state.matches('selecting')}
              onClick={() => send({ type: 'select', slotId: slot.id })}
            >
              {slot.time}
              {slot.taken ? ' · taken' : ''}
            </button>
          </li>
        ))}
      </ul>
      {state.matches('holding') && (
        <div className="hold">
          <p>Holding this slot for {Math.max(0, secondsLeft)}s</p>
          <button onClick={() => send({ type: 'confirm' })}>Confirm</button>
          <button onClick={() => send({ type: 'release' })}>Release</button>
        </div>
      )}
      {state.matches('confirming') && <p>Confirming…</p>}
    </section>
  );
}

export default App;
