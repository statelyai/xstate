import { useActor } from '@xstate/react';
import './App.css';
import { counterMachine } from './counterMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

function App() {
  const [state, send] = useActor(counterMachine, {
    inspect: inspector.inspect
  });

  return (
    <section id="app">
      <output>{state.context.count}</output>
      <button onClick={() => send({ type: 'INCREMENT' })}>Count</button>
    </section>
  );
}

export default App;
