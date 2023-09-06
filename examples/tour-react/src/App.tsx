import './App.css';
import { getShortestPaths } from '@xstate/graph';
import { useMachine } from '@xstate/react';
import { createMachine } from 'xstate';
import { alterPath } from './utils';

const tourMachine = createMachine({
  id: 'tour',
  initial: 'first',
  states: {
    first: {
      description: 'The first step in the tour',
      on: {
        next: { target: 'second', meta: { title: 'Next' } }
      }
    },

    second: {
      description: 'The second step in the tour',
      on: {
        next: { target: 'third', meta: { title: 'Keep going' } },
        back: { target: 'first', meta: { title: 'Go back' } }
      }
    },

    third: {
      description: 'The third step in the tour',
      on: {
        restart: { target: 'first', meta: { title: 'Start over' } },
        back: { target: 'second', meta: { title: 'Go back' } }
      }
    }
  }
});

const shortestPaths = getShortestPaths(tourMachine, {
  toState: (s) => s.matches('third')
}).map(alterPath);

function App() {
  const [state, send] = useMachine(tourMachine);
  const index = shortestPaths[0]?.steps.findIndex((step) =>
    step.state.matches(state.value)
  );
  const description =
    state.configuration.find((s) => s.description)?.description ?? '--';
  const nextTransitions = state.configuration
    .map((sn) => Object.values(sn.on ?? {}))
    .flat(2);

  return (
    <div>
      <h1>
        Step {index + 1} of {shortestPaths[0]?.steps.length}
      </h1>
      <div>
        <h2>{description}</h2>
        {nextTransitions.map((t) => {
          return (
            <button
              onClick={() => send({ type: t.eventType })}
              key={t.eventType}
            >
              {t.meta?.title ?? t.eventType}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default App;
