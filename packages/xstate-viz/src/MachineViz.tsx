import * as React from 'react';

import { StateNodeViz } from './StateNodeViz';
import { StateContext } from './StateContext';
import { EdgesViz } from './EdgesViz';

import { tracker } from './tracker';
import { State, StateMachine } from 'xstate';
import { getAllEdges } from './utils';
import { StateViz } from './StateViz';
import { useTracking } from './useTracker';

interface MachineVizProps {
  state: State<any, any>;
  machine: StateMachine<any, any, any>;
}

const MachineVizContainer: React.FC<MachineVizProps> = ({ machine, state }) => {
  const ref = useTracking(`machine:${machine.id}`);

  return (
    <div
      ref={ref}
      data-xviz="machine"
      title={`machine: #${machine.id}`}
      style={{
        // @ts-ignore
        '--xviz-color-foreground': 'white',
        '--xviz-color-background': 'black',
        '--xviz-color-active': 'rgb(19, 129, 201)',
        '--xviz-border-width': '2px',
        '--xviz-stroke-width': 'var(--xviz-border-width)'
      }}
    >
      <StateNodeViz stateNode={machine} />
      <EdgesViz edges={getAllEdges(machine)} machine={machine} />
      <StateViz state={state} />
    </div>
  );
};

export function MachineViz({ machine, state }: MachineVizProps) {
  return (
    <StateContext.Provider value={{ state, tracker }}>
      <MachineVizContainer machine={machine} state={state} />
    </StateContext.Provider>
  );
}
