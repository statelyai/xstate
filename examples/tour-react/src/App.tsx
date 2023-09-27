import './App.css';
import { StatePath, getShortestPaths } from '@xstate/graph';
import { useActor } from '@xstate/react';
import { createMachine } from 'xstate';
import { Checklist } from './Checklist';
import { Button } from './components/ui/button';
import { Popover } from './components/ui/popover';
import { PopoverContent, PopoverTrigger } from '@radix-ui/react-popover';

const tourMachine = createMachine({
  id: 'tour',
  initial: 'intro',
  states: {
    intro: {
      description: 'The first step in the tour',
      on: {
        next: { target: 'second' }
      }
    },

    second: {
      description: 'The second step in the tour',
      on: {
        next: { target: 'third' },
        back: { target: 'intro' }
      }
    },

    third: {
      description: 'The third step in the tour',
      on: {
        restart: { target: 'intro' },
        back: { target: 'second' },
        finish: { target: 'done' }
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
      <Popover open={state.matches('intro')}>
        <PopoverTrigger>
          <Button>Something</Button>
        </PopoverTrigger>
        {/* add tailwind border */}
        <PopoverContent className="w-80 flex flex-col gap-2 border-2 p-4">
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Magnam
            reprehenderit eaque recusandae sed consectetur? Doloribus, est eum
            minima eius explicabo debitis eveniet culpa, temporibus ratione
            provident enim at odit quibusdam.
          </p>
          <div className="flex flex-row gap-2 justify-center">
            <Button
              onClick={() => send({ type: 'back' })}
              disabled={!state.can({ type: 'back' })}
            >
              Back
            </Button>
            <Button onClick={() => send({ type: 'next' })}>Next</Button>
          </div>
        </PopoverContent>
      </Popover>
      <Popover open={state.matches('second')}>
        <PopoverTrigger>
          <Button>Something</Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Magnam
            reprehenderit eaque recusandae sed consectetur? Doloribus, est eum
            minima eius explicabo debitis eveniet culpa, temporibus ratione
            provident enim at odit quibusdam.
          </p>
          <Button onClick={() => send({ type: 'back' })}>Back</Button>
          <Button onClick={() => send({ type: 'next' })}>Next</Button>
        </PopoverContent>
      </Popover>
      <Popover open={state.matches('third')}>
        <PopoverTrigger>
          <Button>Something</Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Magnam
            reprehenderit eaque recusandae sed consectetur? Doloribus, est eum
            minima eius explicabo debitis eveniet culpa, temporibus ratione
            provident enim at odit quibusdam.
          </p>
          <Button onClick={() => send({ type: 'back' })}>Back</Button>
          <Button onClick={() => send({ type: 'next' })}>Next</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default App;
