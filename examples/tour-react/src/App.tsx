import './App.css';
import { getShortestPaths, joinPaths } from '@xstate/graph';
import { useActor } from '@xstate/react';
import { createMachine } from 'xstate';

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
        back: { target: 'first', meta: { title: 'Go back' } },
        long: { target: 'longWay', meta: { title: 'Go the long way' } }
      }
    },

    longWay: {
      description: 'The long way around',
      initial: 'one',
      states: {
        one: {
          on: {
            next: 'two'
          }
        },
        two: {
          on: {
            next: 'three'
          }
        },
        three: {
          type: 'final'
        }
      },
      onDone: 'third'
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
});

function App() {
  const [state, send] = useActor(tourMachine);
  const pathToState = getShortestPaths(tourMachine, {
    toState: (s) => s.matches(state.value)
  })[0];
  const pathFromStateToFinal = getShortestPaths(tourMachine, {
    fromState: pathToState.state,
    toState: (s) => s.matches('third')
  })[0];
  const aggregateSteps = pathToState.steps.concat(pathFromStateToFinal.steps);
  const index = aggregateSteps.findIndex((step) =>
    step.state.matches(state.value)
  );
  const description =
    state.configuration.find((s) => s.description)?.description ?? '--';
  const nextTransitions = state.configuration
    .map((sn) => Object.values(sn.on ?? {}))
    .flat(2)
    .filter((t) => !t.eventType.startsWith('done.state.'));

  return (
    <div>
      <h1>
        Step {index + 1} of {aggregateSteps.length - 1}
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
