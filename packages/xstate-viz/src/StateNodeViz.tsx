import * as React from 'react';
import { useContext, useEffect, useRef, useMemo } from 'react';
import { StateContext } from './StateContext';
import { StateNode } from 'xstate';
import { EventViz } from './EventViz';
import { getEdges, serializeTransition, isActive } from './utils';

interface StateNodeVizProps {
  stateNode: StateNode<any, any, any>;
}

export function StateNodeViz({ stateNode }: StateNodeVizProps) {
  const { tracker, state } = useContext(StateContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    tracker.update(stateNode.id, ref.current!);
  }, []);

  const edges = useMemo(() => getEdges(stateNode), [stateNode]);

  const active = isActive(state, stateNode);

  return (
    <div
      data-xviz-element="stateNode"
      data-xviz-active={active || undefined}
      title={`state node: #${stateNode.id}`}
    >
      <div data-xviz-element="stateNode-state" ref={ref}>
        <header>
          <strong>{stateNode.key}</strong>
        </header>
        <div data-xviz-element="stateNode-children">
          {Object.keys(stateNode.states).map(key => {
            const childStateNode = stateNode.states[key];
            return (
              <StateNodeViz
                stateNode={stateNode.states[key]}
                key={childStateNode.id}
              />
            );
          })}
        </div>
      </div>
      <div data-xviz-element="events">
        {edges.map(edge => {
          return (
            <EventViz edge={edge} key={serializeTransition(edge.transition)} />
          );
        })}
      </div>
    </div>
  );
}
