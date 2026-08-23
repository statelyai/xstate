import './App.css';
import { useActor } from '@xstate/react';
import { temperatureMachine } from './temperatureMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

function App() {
  const [state, send] = useActor(temperatureMachine, {
    inspect: inspector.inspect
  });

  const { tempC, tempF } = state.context;

  return (
    <section>
      <label>
        <input
          type="number"
          id="celsius"
          value={tempC ?? ''}
          onChange={(e) => {
            send({ type: 'CELSIUS', value: e.target.value });
          }}
          placeholder="e.g., 0"
        />
        <span>˚C</span>
      </label>
      <div>=</div>
      <label>
        <input
          type="number"
          id="fahrenheit"
          value={tempF ?? ''}
          onChange={(e) => {
            send({ type: 'FAHRENHEIT', value: e.target.value });
          }}
          placeholder="e.g., 32"
        />
        <span>˚F</span>
      </label>
    </section>
  );
}

export default App;
