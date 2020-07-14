import * as React from 'react';

import { StateNodeViz } from './StateNodeViz';
import { StateContext } from './StateContext';
import { EdgesViz } from './EdgesViz';

import { Tracker } from './tracker';
import { State, StateMachine, createMachine, assign } from 'xstate';
import { getAllEdges } from './utils';
import { useTracking } from './useTracker';
import { useMachine } from '@xstate/react';

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
            })
          ]
        },
        zoom: {
          actions: [
            assign({
              zoom: (_, e) => e.value
            })
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
  const [state, send] = useMachine(canvasMachine);
  const { zoom } = state.context;
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
        // '--xviz-zoom': zoom,
        '--xviz-zoom': 1,
        height: '100vh',
        width: '100vw'
      }}
      onWheel={(e) => {
        const groupEl = (e.currentTarget as HTMLDivElement).querySelector(
          '[data-xviz="machine-group"]'
        );

        if (groupEl) {
          if (!(groupEl as any).__xy) {
            (groupEl as any).__xy = { x: 0, y: 0 };
          }
          (groupEl as any).__xy.x -= e.deltaX;
          (groupEl as any).__xy.y -= e.deltaY;

          const { x, y } = (groupEl as any).__xy;

          groupEl.setAttribute(
            'style',
            `transform: translate(${x}px, ${y}px) scale(${zoom})`
          );
        }
      }}
    >
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: '100%',
          overflow: 'visible'
        }}
        // viewBox={'0 0 100 100'}
        // viewBox={`0 0 ${100 / zoom} ${100 / zoom}`}
      >
        {/* {rects.map((item: any) => {
          return (
            <rect
              key={item.id}
              x={item.rect.left}
              y={item.rect.top}
              width={item.rect.width}
              height={item.rect.height}
              stroke="red"
              strokeWidth={2}
            ></rect>
          );
        })} */}
        <g data-xviz="machine-group">
          <EdgesViz edges={getAllEdges(machine)} machine={machine} />
          <foreignObject
            data-xviz="machine-foreignObject"
            x={0}
            y={0}
            width={1000}
            height={1000}
          >
            <div
              data-xviz="machine"
              title={`machine: #${machine.id}`}
              style={
                {
                  // transform: `translate(${scroll.x}px, ${scroll.y}px) scale(${zoom})`
                }
              }
            >
              <StateNodeViz stateNode={machine} />
            </div>
          </foreignObject>
        </g>
      </svg>
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

  return (
    <StateContext.Provider value={{ state, tracker }}>
      <MachineVizContainer machine={machine} state={state} />
    </StateContext.Provider>
  );
}
