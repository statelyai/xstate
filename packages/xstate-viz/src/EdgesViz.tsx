import * as React from 'react';
import { Edge } from './types';
import { EdgeViz } from './EdgeViz';

export function EdgesViz({ edges }: { edges: Array<Edge<any, any, any>> }) {
  return (
    <svg
      data-xviz-element="edges"
      style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}
    >
      {edges.map((edge, i) => {
        return <EdgeViz edge={edge} key={i} />;
      })}
    </svg>
  );
}
