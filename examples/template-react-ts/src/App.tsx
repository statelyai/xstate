import React from 'react';
import './App.css';
import { useMachine } from '@xstate/react';
import { toggleMachine } from './toggle.machine';

function App() {
  const [state, send] = useMachine(toggleMachine);
  const active = state.matches('active');
  const { count } = state.context;

  return (
    <div className="app">
      <h1>XState React Template</h1>
      <h2>Fork this template!</h2>
      <button onClick={() => send('TOGGLE')}>
        Click me ({active ? '✅' : '❌'})
      </button>{' '}
      <code>
        Toggled <strong>{count}</strong> times
      </code>
    </div>
  );
}

export default App;
