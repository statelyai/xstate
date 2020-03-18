import * as React from 'react';
// import { useContext, useEffect, useRef } from 'react';
// import { StateContext } from './StateContext';
import { Edge } from './types';
import { useEffect, useContext, useRef } from 'react';
import { StateContext } from './StateContext';
import { serializeTransition } from './utils';

interface EventVizProps {
  edge: Edge<any, any>;
}

export function EventViz({ edge }: EventVizProps) {
  const { tracker } = useContext(StateContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    tracker.update(serializeTransition(edge.transition), ref.current!);
  }, []);

  return (
    <div data-xviz-element="event" title={`event: ${edge.event}`} ref={ref}>
      {edge.event}
    </div>
  );
}
