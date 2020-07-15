import * as React from 'react';

import { StateNodeViz } from './StateNodeViz';
import { StateContext } from './StateContext';
import { EdgesViz } from './EdgesViz';

import { Tracker } from './tracker';
import { State, StateMachine, createMachine, assign, interpret } from 'xstate';
import { getAllEdges } from './utils';
import { useTracking } from './useTracker';
import { useMachine } from '@xstate/react';
import {
  machineVizMachine,
  StateNodeTapEvent,
  EventTapEvent
} from './machineVizMachine';

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
              zoom: (ctx, e) => ctx.zoom + e.value
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
  onStateNodeTap?: ({ stateNodeId: string }) => void;
  onEventTap?: (data: {
    stateNodeId: string;
    eventType: string;
    index: number;
  }) => void;
  style?: React.CSSProperties;
}

interface ResultBox<T> {
  v: T;
}

export default function useConstant<T>(fn: () => T): T {
  const ref = React.useRef<ResultBox<T>>();

  if (!ref.current) {
    ref.current = { v: fn() };
  }

  return ref.current.v;
}

const MachineVizContainer: React.FC<MachineVizProps> = ({ machine, style }) => {
  const service = useConstant(() => interpret(canvasMachine).start());
  const ref = useTracking(`machine:${machine.id}`);
  const groupRef = React.useRef<SVGGElement | null>(null);

  React.useEffect(() => {
    service.subscribe(({ context }) => {
      if (!groupRef.current) {
        return;
      }

      const {
        scroll: { x, y },
        zoom
      } = context;

      groupRef.current.setAttribute(
        'style',
        `transform: translate(${x}px, ${y}px) scale(${zoom})`
      );
    });
  }, []);

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
        ...style
      }}
      onWheel={(e) => {
        service.send(e);
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
        <g data-xviz="machine-group" ref={groupRef}>
          <EdgesViz edges={getAllEdges(machine)} machine={machine} />

          <foreignObject
            data-xviz="machine-foreignObject"
            x={0}
            y={0}
            width={1000}
            height={1000}
          >
            <div data-xviz="machine" title={`machine: #${machine.id}`}>
              <StateNodeViz stateNode={machine} />
            </div>
          </foreignObject>
        </g>
      </svg>
      <div data-xviz="controls">
        <button
          data-xviz="button"
          onClick={() => {
            service.send('zoom', { value: -0.1 });
          }}
        >
          -
        </button>
        <button
          data-xviz="button"
          onClick={() => {
            service.send('zoom', { value: 0.1 });
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
  state = machine.initialState,
  onStateNodeTap,
  onEventTap
}: MachineVizProps) {
  const [, , service] = useMachine(machineVizMachine, {
    actions: {
      stateNodeTapped: (_, e) => onStateNodeTap?.(e as StateNodeTapEvent),
      eventTapped: (_, e) => onEventTap?.(e as EventTapEvent)
    }
  });
  const tracker = React.useMemo(() => new Tracker(), []);

  return (
    <StateContext.Provider value={{ state, tracker, service }}>
      <MachineVizContainer machine={machine} state={state} />
    </StateContext.Provider>
  );
}
