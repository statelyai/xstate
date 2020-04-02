import * as React from 'react';
// import { useContext, useEffect, useRef } from 'react';
// import { StateContext } from './StateContext';
import { Edge } from './types';
import { useEffect, useContext, useRef } from 'react';
import { StateContext } from './StateContext';
import { serializeTransition, isBuiltinEvent, toDelayString } from './utils';
import { ActionViz } from './ActionViz';

interface EventVizProps {
  edge: Edge<any, any>;
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

function formatEvent(event: string): JSX.Element | string {
  if (event.startsWith('done.state.')) {
    return 'onDone';
  }

  if (event.startsWith('xstate.after')) {
    const [, delay] = event.match(/^xstate\.after\((.*)\)#.*$/);

    return `after ${toDelayString(delay)}`;
  }

  return event;
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

  const meta = getEventMeta(transition.eventType);

  return (
    <div
      data-xviz="event"
      data-xviz-event={edge.event}
      data-xviz-builtin={isBuiltinEvent(edge.event) || undefined}
      data-xviz-transient={edge.event === '' || undefined}
      data-xviz-guarded={!!transition.cond || undefined}
      title={`event: ${edge.event}`}
    >
      <div data-xviz="event-label" ref={ref}>
        <div data-xviz="event-type">{formatEvent(transition.eventType)}</div>
        {transition.cond && (
          <div data-xviz="event-cond" data-xviz-name={transition.cond.name}>
            <div data-xviz="event-cond-name">{transition.cond.name}</div>
          </div>
        )}
      </div>
      <div data-xviz="event-targets">
        {transition.target &&
          transition.target.map(target => {
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
