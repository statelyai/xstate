import './App.css';
import { assign, createMachine } from 'xstate';
import { createActorContext } from '@xstate/react';

const counterMachine = createMachine({
  context: {
    count: 0
  },
  on: {
    increment: {
      cond: (ctx) => ctx.count < 10,
      actions: assign({
        count: (ctx) => ctx.count + 1
      })
    },
    decrement: {
      cond: (ctx) => ctx.count > 0,
      actions: assign({
        count: (ctx) => ctx.count - 1
      })
    }
  }
});

const CounterContext = createActorContext(counterMachine);

function Count() {
  const [state, send] = CounterContext.useActor();
  const {
    context: { count },
    nextEvents
  } = state;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '1rem',
        alignItems: 'center'
      }}
    >
      Count: <output>{count}</output>
      {nextEvents.map((nextEventType) => {
        const event = { type: nextEventType };

        return (
          <button
            key={nextEventType}
            onClick={() => send({ type: nextEventType })}
            disabled={!state.can(event)}
          >
            {nextEventType}
          </button>
        );
      })}
    </div>
  );
}

function App() {
  return (
    <CounterContext.Provider>
      <Count />
    </CounterContext.Provider>
  );
}

export default App;
