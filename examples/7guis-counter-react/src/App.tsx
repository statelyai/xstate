import React from 'react';
import './App.css';
import { useMachine } from '@xstate/react';
import { counterMachine } from './counterMachine';

function App() {
  const [state, send] = useMachine(counterMachine);

  return (
    <section id="app">
      <output>{state.context.count}</output>
      <button onClick={() => send({ type: 'INCREMENT' })}>Count</button>
    </section>
  );
}

export default App;
