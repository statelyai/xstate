import React from 'react';
import './App.css';
import { createMachine, assign } from 'xstate';
import { useMachine } from '@xstate/react';

interface ToggleContext {
  count: number;
}

const toggleMachine = createMachine<ToggleContext>({
  id: 'toggle',
  initial: 'inactive',
  context: {
    count: 0
  },
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      entry: assign({ count: (ctx) => ctx.count + 1 }),
      on: { TOGGLE: 'inactive' }
    }
  }
});

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
