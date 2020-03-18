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
    <div data-xviz-element="machine" title={`machine: #${machine.id}`}>
      <StateContext.Provider value={{ state, tracker }}>
        <StateNodeViz stateNode={machine} />
        <EdgesViz edges={getAllEdges(machine)} />
      </StateContext.Provider>
    </div>
  );
}
