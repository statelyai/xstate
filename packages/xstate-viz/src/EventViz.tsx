import * as React from 'react';
// import { useContext, useEffect, useRef } from 'react';
// import { StateContext } from './StateContext';
import { Edge } from './types';
import { useContext } from 'react';
import { StateContext } from './StateContext';
import {
  serializeTransition,
  isBuiltinEvent,
  toDelayString,
  getPartialStateValue
} from './utils';
import { ActionViz } from './ActionViz';
import { useTracking } from './useTracker';

interface EventVizProps {
  edge: Edge<any, any>;
  index: number;
}

function getEventMeta(eventType: string): Record<string, any> | undefined {
  if (eventType.startsWith('xstate.after')) {
    const [, delay] = eventType.match(/^xstate\.after\((.*)\)#.*$/);

    return { delay };
  }

  return undefined;
}

function stringify(value: any): string | number {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  return JSON.stringify(value);
}

export const EventTypeViz: React.FC<{ event: string }> = ({ event }) => {
  if (event.startsWith('done.state.')) {
    return <>onDone</>;
  }

  if (event.startsWith('done.invoke.')) {
    const match = event.match(/^done\.invoke\.(.+)$/);
    return (
      <>
        <em style={{ color: 'green' }}>done:</em> {match ? match[1] : '??'}
      </>
    );
  }

  if (event.startsWith('error.platform.')) {
    const match = event.match(/^error\.platform\.(.+)$/);
    return (
      <>
        <em style={{ color: 'red' }}>error:</em> {match ? match[1] : '??'}
      </>
    );
  }

  if (event.startsWith('xstate.after')) {
    const [, delay] = event.match(/^xstate\.after\((.*)\)#.*$/);

    return (
      <>
        <em>after</em> {toDelayString(delay)}
      </>
    );
  }

  if (event === '') {
    return (
      <>
        <em>always</em>
      </>
    );
  }

  return <>{event}</>;
};

export function EventViz({ edge, index }: EventVizProps) {
  const { state, service } = useContext(StateContext);
  const ref = useTracking(serializeTransition(edge.transition));

  const { transition } = edge;

  const meta = getEventMeta(transition.eventType);

  const triggered =
    state.event.type === edge.event &&
    state.history?.matches(getPartialStateValue(edge.source));

  return (
    <div
      data-xviz="event"
      data-xviz-event={edge.event}
      data-xviz-index={index}
      data-xviz-builtin={isBuiltinEvent(edge.event) || undefined}
      data-xviz-transient={edge.event === '' || undefined}
      data-xviz-guarded={!!transition.cond || undefined}
      data-xviz-triggered={triggered || undefined}
      title={`event: ${edge.event} → #${edge.target.id}`}
      onClick={(e) => {
        e.stopPropagation();
        service.send({
          type: 'event.tap',
          eventType: edge.event,
          index,
          stateNodeId: edge.source.id
        });
      }}
    >
      <div data-xviz="event-label" ref={ref}>
        <div data-xviz="event-type">
          <EventTypeViz event={transition.eventType} />
        </div>
        {transition.cond && (
          <div data-xviz="event-cond" data-xviz-name={transition.cond.name}>
            <div data-xviz="event-cond-name">{transition.cond.name}</div>
          </div>
        )}
      </div>
      <div data-xviz="event-targets">
        {transition.target &&
          transition.target.map((target) => {
            return (
              <div data-xviz="event-target" key={target.id}>
                #{target.id}
              </div>
            );
          })}
      </div>
      {meta && (
        <div data-xviz="event-meta">
          {Object.entries(meta).map(([key, value]) => {
            return (
              <div data-xviz="event-meta-entry" data-xviz-key={key} key={key}>
                <div data-xviz="event-meta-key">{key}</div>
                <div data-xviz="event-meta-value">{stringify(value)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div data-xviz="actions">
        {transition.actions.map((action, i) => {
          return <ActionViz action={action} key={i} />;
        })}
      </div>
    </div>
  );
}
