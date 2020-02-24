import * as React from 'react';
import { useContext, useEffect, useRef } from 'react';
import { StateContext } from './StateContext';
import { StateNode } from 'xstate';

interface StateNodeVizProps {
  stateNode: StateNode<any, any, any>;
}

export function StateNodeViz({ stateNode }: StateNodeVizProps) {
  const { tracker } = useContext(StateContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    tracker.update(stateNode.id, ref.current!);
  }, []);

  return (
    <div data-xviz-element="stateNode" title={`state node: #${stateNode.id}`}>
      <div data-xviz-element="stateNode-state" ref={ref}>
        <header>
          <strong>{stateNode.key}</strong>
        </header>
        <div data-xviz-element="stateNode-children">
          {Object.keys(stateNode.states).map(key => {
            return <StateNodeViz stateNode={stateNode.states[key]} key={key} />;
          })}
        </div>
      </div>
      <div data-xviz-element="events">
        {stateNode.events.map(event => {
          return <div data-xviz-element="event">{event}</div>;
        })}
      </div>
    </div>
  );
}
