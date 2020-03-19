import * as React from 'react';
// import { useContext, useEffect, useRef } from 'react';
// import { StateContext } from './StateContext';
import { Edge } from './types';
import { useEffect, useContext, useRef } from 'react';
import { StateContext } from './StateContext';
import { serializeTransition } from './utils';
import { ActionViz } from './ActionViz';

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

  const { transition } = edge;

  return (
    <div data-xviz-element="event" title={`event: ${edge.event}`} ref={ref}>
      <div
        data-xviz-element="event-type"
        data-xviz-builtin={edge.event.startsWith('xstate.') || undefined}
      >
        {transition.eventType}
      </div>
      {transition.cond && (
        <div data-xviz-element="event-cond">{transition.cond.type}</div>
      )}
      <dl data-xviz-element="event-actions">
        {transition.actions.map((action, i) => {
          return <ActionViz action={action} key={i} />;
        })}
      </dl>
    </div>
  );
}
