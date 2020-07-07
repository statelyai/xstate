import * as React from 'react';

import { StateNodeViz } from './StateNodeViz';
import { StateContext } from './StateContext';
import { EdgesViz } from './EdgesViz';

import { Tracker } from './tracker';
import { State, StateMachine, createMachine, assign } from 'xstate';
import { getAllEdges } from './utils';
import { useTracking } from './useTracker';
import { useMachine } from '@xstate/react';
import { asEffect } from '@xstate/react/lib/useMachine';

interface CanvasCtx {
  zoom: number;
  scroll: {
    x: number;
    y: number;
  };
}

const canvasMachine = createMachine<CanvasCtx>({
  initial: 'active',
  context: {
    zoom: 1,
    scroll: { x: 0, y: 0 }
  },
  states: {
    active: {
      on: {
        wheel: {
          actions: [
            assign({
              scroll: (ctx, e) => ({
                x: ctx.scroll.x - e.deltaX,
                y: ctx.scroll.y - e.deltaY
              })
            }),
            'track'
          ]
        },
        zoom: {
          actions: [
            assign({
              zoom: (_, e) => e.value
            }),
            'track'
          ]
        }
      }
    }
  }
});

interface MachineVizProps {
  state?: State<any, any>;
  machine: StateMachine<any, any, any>;
}

const MachineVizContainer: React.FC<MachineVizProps> = ({ machine }) => {
  const { tracker } = React.useContext(StateContext);
  const [state, send] = useMachine(canvasMachine, {
    actions: {
      track: asEffect(() => {
        const i = requestAnimationFrame(() => tracker.updateAll());

        return () => {
          cancelAnimationFrame(i);
        };
      })
    }
  });
  const { zoom, scroll } = state.context;
  const ref = useTracking(`machine:${machine.id}`);

  return (
    <div
      data-xviz="machine-container"
      ref={ref}
      style={{
        // @ts-ignore
        '--xviz-color-foreground': 'white',
        '--xviz-color-background': 'black',
        '--xviz-active-color': 'rgb(19, 129, 201)',
        '--xviz-border-width': '2px',
        '--xviz-stroke-width': 'var(--xviz-border-width)',
        '--xviz-zoom': zoom
      }}
      onWheel={(e) => {
        send(e);
      }}
    >
      <div
        data-xviz="machine"
        title={`machine: #${machine.id}`}
        style={{
          transform: `translate(${scroll.x}px, ${scroll.y}px) scale(${zoom})`
        }}
      >
        <StateNodeViz stateNode={machine} />
      </div>
      <EdgesViz edges={getAllEdges(machine)} machine={machine} />
      <div data-xviz="controls">
        <button
          data-xviz="button"
          onClick={() => {
            send('zoom', { value: zoom - 0.1 });
          }}
        >
          -
        </button>
        <button
          data-xviz="button"
          onClick={() => {
            send('zoom', { value: zoom + 0.1 });
          }}
        >
          +
        </button>
      </div>
    </div>
  );
};

export function MachineViz({
  machine,
  state = machine.initialState
}: MachineVizProps) {
  const tracker = React.useMemo(() => new Tracker(), []);
  // const [zoom, setZoom] = useState(1);
  // const [scroll, setScroll] = useState({ x: 0, y: 0 });

  // React.useEffect(() => {
  //   const i = requestAnimationFrame(() => tracker.updateAll());

  //   return () => {
  //     cancelAnimationFrame(i);
  //   };
  // }, [zoom, scroll]);

  return (
    <StateContext.Provider value={{ state, tracker }}>
      <MachineVizContainer machine={machine} state={state} />
    </StateContext.Provider>
  );
}
