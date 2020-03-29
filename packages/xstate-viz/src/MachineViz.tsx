import * as React from 'react';
import { StateNodeViz } from './StateNodeViz';
import { StateContext } from './StateContext';
import { EdgesViz } from './EdgesViz';

import { tracker } from './tracker';
import { State, StateMachine } from 'xstate';
import { getAllEdges } from './utils';

interface MachineVizProps {
  state: State<any, any>;
  machine: StateMachine<any, any, any>;
}

export function MachineViz({ machine, state }: MachineVizProps) {
  return (
    <div
      data-xviz="machine"
      title={`machine: #${machine.id}`}
      style={{
        // @ts-ignore
        '--xviz-color-foreground': 'black',
        '--xviz-color-background': 'white',
        '--xviz-color-primary': 'rgba(87,176,234,1)',
        '--xviz-color-active': 'rgba(87,176,234,1)',
        '--xviz-border-width': '2px',
        '--xviz-stroke-width': 'var(--xviz-border-width)'
      }}
    >
      <StateContext.Provider value={{ state, tracker }}>
        <StateNodeViz stateNode={machine} />
        <EdgesViz edges={getAllEdges(machine)} machine={machine} />
      </StateContext.Provider>
    </div>
  );
}
