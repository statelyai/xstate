import * as React from 'react';
import { useContext, useMemo } from 'react';
import { StateContext } from './StateContext';
import { StateNode } from 'xstate';
import { EventViz } from './EventViz';
import { getEdges, serializeTransition, isActive } from './utils';
import { ActionViz } from './ActionViz';
import { InvokeViz } from './InvokeViz';

import { useTracker } from './useTracker';

interface StateNodeVizProps {
  stateNode: StateNode<any, any, any>;
}

export function StateNodeViz({ stateNode }: StateNodeVizProps) {
  const { state } = useContext(StateContext);
  const ref = useTracker(stateNode.id);

  const edges = useMemo(() => getEdges(stateNode), [stateNode]);

  const active = isActive(state, stateNode);

  return (
    <div
      data-xviz-element="stateNode"
      data-xviz-type={stateNode.type}
      data-xviz-active={active || undefined}
      title={`state node: #${stateNode.id}`}
      // onClick={active}
    >
      <div data-xviz-element="stateNode-state" ref={ref}>
        <div data-xviz-element="stateNode-content">
          <strong>{stateNode.key}</strong>
          {stateNode.onEntry.length > 0 && (
            <ul data-xviz-element="stateNode-actions" data-xviz-actions="entry">
              {stateNode.onEntry.map((entryAction, i) => {
                return <ActionViz action={entryAction} key={i} />;
              })}
            </ul>
          )}
          {stateNode.invoke.length > 0 && (
            <div data-xviz-element="stateNode-invocations">
              {stateNode.invoke.map((invokeDef, i) => {
                return <InvokeViz invoke={invokeDef} key={i} />;
              })}
            </div>
          )}
          {stateNode.onExit.length > 0 && (
            <ul data-xviz-element="stateNode-actions" data-xviz-actions="exit">
              {stateNode.onExit.map((exitAction, i) => {
                return <ActionViz action={exitAction} key={i} />;
              })}
            </ul>
          )}
        </div>
        {Object.keys(stateNode.states).length > 0 && (
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
        )}
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
