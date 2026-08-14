import { useActor } from '@xstate/react';
import './App.css';
import { counterMachine } from './counterMachine';

function App() {
  const [state, send] = useActor(counterMachine);

  return (
    <section id="app">
      <output>{state.context.count}</output>
      <button onClick={() => send({ type: 'INCREMENT' })}>Count</button>
    </section>
  );
}

export default App;
