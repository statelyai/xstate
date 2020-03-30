import * as React from 'react';
import { Edge } from './types';
import { EdgeViz, InitialEdgeViz } from './EdgeViz';
import { ArrowMarker } from './ArrowMarker';
import { StateMachine } from 'xstate/src';
import { getAllStateNodes } from 'xstate/lib/stateUtils';

export function EdgesViz({
  edges,
  machine
}: {
  edges: Array<Edge<any, any, any>>;
  machine: StateMachine<any, any, any>;
}) {
  const childNodes = getAllStateNodes(machine).filter(
    sn => sn.parent && sn.parent.initial === sn.key
  );

  return (
    <svg
      data-xviz="edges"
      style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}
    >
      <defs>
        <ArrowMarker />
      </defs>
      {childNodes.map(cn => {
        return <InitialEdgeViz stateNode={cn} key={cn.id} />;
      })}
      {edges.map((edge, i) => {
        return <EdgeViz edge={edge} key={i} />;
      })}
    </svg>
  );
}
