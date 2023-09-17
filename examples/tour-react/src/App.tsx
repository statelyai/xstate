import './App.css';
import { StatePath, getShortestPaths } from '@xstate/graph';
import { useActor } from '@xstate/react';
import { createMachine } from 'xstate';
import { Checklist } from './Checklist';

const tourMachine = createMachine({
  id: 'tour',
  initial: 'intro',
  states: {
    intro: {
      description: 'The first step in the tour',
      on: {
        next: { target: 'second', meta: { title: 'Next' } }
      }
    },

    second: {
      description: 'The second step in the tour',
      on: {
        next: { target: 'third', meta: { title: 'Keep going' } },
        back: { target: 'intro', meta: { title: 'Go back' } }
      }
    },

    third: {
      description: 'The third step in the tour',
      on: {
        restart: { target: 'intro', meta: { title: 'Start over' } },
        back: { target: 'second', meta: { title: 'Go back' } },
        finish: { target: 'done', meta: { title: 'Finish' } }
      }
    },
    done: {
      type: 'final'
    }
  }
});

const shortestPaths = getShortestPaths(tourMachine, {
  toState: (s) => {
    return s.matches('done');
  }
});

function TourProgress({
  path,
  state,
  ...rest
}: {
  path: StatePath<any, any>;
  state: any;
} & React.HTMLAttributes<HTMLDivElement>) {
  const index = path.steps.findIndex((step) => step.state.matches(state.value));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '1rem',
        ...rest.style
      }}
    >
      {path.steps.slice(0, -1).map((step, i) => {
        const isVisited = i <= index;

        return (
          <div
            key={i}
            style={{
              height: '1rem',
              width: '1rem',
              background: isVisited ? 'green' : 'gray',
              borderRadius: '50%'
            }}
          ></div>
        );
      })}
    </div>
  );
}

function App() {
  const [state, send] = useActor(tourMachine);
  const shortestPath = shortestPaths[0];
  const description =
    state.configuration.find((s) => s.description)?.description ?? '--';
  const nextTransitions = state.configuration
    .map((sn) => Object.values(sn.on ?? {}))
    .flat(2)
    .filter((t) => !t.eventType.startsWith('done.state.'));

  if (state.done) {
    return null;
  }

  return (
    <div>
      <Checklist />
      <div
        style={{
          padding: '1rem',
          background: 'white',
          borderRadius: '.5rem',
          color: '#111',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '1rem'
        }}
      >
        <h2>{description}</h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '1rem',
            justifyContent: 'center'
          }}
        >
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
        <TourProgress
          path={shortestPath}
          state={state}
          style={{
            alignSelf: 'center'
          }}
        />
      </div>
    </div>
  );
}

export default App;
