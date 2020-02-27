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
        <div data-xviz-element="stateNode-content">
          <strong>{stateNode.key}</strong>
          {stateNode.onEntry.length > 0 && (
            <ul data-xviz-element="stateNode-actions" data-xviz-actions="entry">
              {stateNode.onEntry.map((entryAction, i) => {
                return (
                  <li data-xviz-element="stateNode-action" key={i}>
                    {entryAction.type}
                  </li>
                );
              })}
            </ul>
          )}
          {stateNode.invoke.length > 0 && (
            <ul data-xviz-element="stateNode-invocations">
              {stateNode.invoke.map((invokeDef, i) => {
                return (
                  <li data-xviz-element="stateNode-invocation" key={i}>
                    <div data-xviz-element="stateNode-invocation-src">
                      {invokeDef.src}
                    </div>
                    <div data-xviz-element="stateNode-invocation-id">
                      {invokeDef.id}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {stateNode.onExit.length > 0 && (
            <ul data-xviz-element="stateNode-actions" data-xviz-actions="exit">
              {stateNode.onExit.map((exitAction, i) => {
                return (
                  <li data-xviz-element="stateNode-action" key={i}>
                    {exitAction.type}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
