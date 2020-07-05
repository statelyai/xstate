import * as React from 'react';

import { StateNodeViz } from './StateNodeViz';
import { StateContext } from './StateContext';
import { EdgesViz } from './EdgesViz';

import { Tracker } from './tracker';
import { State, StateMachine } from 'xstate';
import { getAllEdges } from './utils';
import { useTracking } from './useTracker';
import { useState } from 'react';

interface MachineVizProps {
  state?: State<any, any>;
  machine: StateMachine<any, any, any>;
}

const MachineVizContainer: React.FC<
  MachineVizProps & {
    onWheel: React.DOMAttributes<HTMLDivElement>['onWheel'];
  }
> = ({ machine, onWheel }) => {
  const { zoom, scroll } = React.useContext(StateContext);
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
      onWheel={onWheel}
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
    </div>
  );
};

export function MachineViz({
  machine,
  state = machine.initialState
}: MachineVizProps) {
  const tracker = React.useMemo(() => new Tracker(), []);
  const [zoom, setZoom] = useState(1);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const i = requestAnimationFrame(() => tracker.updateAll());

    return () => {
      cancelAnimationFrame(i);
    };
  }, [zoom, scroll]);

  return (
    <StateContext.Provider value={{ state, tracker, zoom, scroll }}>
      <MachineVizContainer
        machine={machine}
        state={state}
        onWheel={(e) => {
          e.preventDefault();
          setScroll({
            x: scroll.x - e.deltaX,
            y: scroll.y - e.deltaY
          });
        }}
      />
      <button
        onClick={() => {
          setZoom(zoom - 0.1);
        }}
      >
        -
      </button>
      <button
        onClick={() => {
          setZoom(zoom + 0.1);
        }}
      >
        +
      </button>
    </StateContext.Provider>
  );
}
