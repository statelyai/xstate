import * as React from 'react';
// import { useContext, useEffect, useRef } from 'react';
// import { StateContext } from './StateContext';
import { Edge } from './utils';

interface EventVizProps {
  edge: Edge<any, any>;
}

export function EventViz({ edge }: EventVizProps) {
  return (
    <div data-xviz-element="event" title={`event: ${edge.event}`}>
      {edge.event}
    </div>
  );
}
