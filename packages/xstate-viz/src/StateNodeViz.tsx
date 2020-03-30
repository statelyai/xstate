import * as React from 'react';
import { useContext, useMemo } from 'react';
import { StateContext } from './StateContext';
import { StateNode } from 'xstate';
import { EventViz } from './EventViz';
import { getEdges, serializeTransition, isActive, getLevel } from './utils';
import { ActionViz } from './ActionViz';
import { InvokeViz } from './InvokeViz';

import { useTracking } from './useTracker';

interface StateNodeVizProps {
  stateNode: StateNode<any, any, any>;
}

export function StateNodeViz({ stateNode }: StateNodeVizProps) {
  const { state } = useContext(StateContext);
  const ref = useTracking(stateNode.id);

  const edges = useMemo(() => getEdges(stateNode), [stateNode]);

  const active = isActive(state, stateNode);

  return (
    <div
      data-xviz="stateNode"
      data-xviz-type={stateNode.type}
      data-xviz-parent-type={
        stateNode.parent ? stateNode.parent.type : 'machine'
      }
      data-xviz-history={stateNode.history || undefined}
      data-xviz-active={active || undefined}
      data-xviz-level={getLevel(stateNode)}
      title={`#${stateNode.id} ${
        ['history', 'final'].includes(stateNode.type)
          ? `(${stateNode.type})`
          : ''
      }`}
      style={{
        // @ts-ignore
        '--xviz-level': getLevel(stateNode)
      }}
    >
      <div data-xviz="stateNode-state" ref={ref}>
        <div data-xviz="stateNode-content">
          <div data-xviz="stateNode-key">{stateNode.key}</div>
          {stateNode.onEntry.length > 0 && (
            <div data-xviz="actions" data-xviz-actions="entry">
              {stateNode.onEntry.map((entryAction, i) => {
                return <ActionViz action={entryAction} key={i} />;
              })}
            </div>
          )}
          {stateNode.invoke.length > 0 && (
            <div data-xviz="stateNode-invocations">
              {stateNode.invoke.map((invokeDef, i) => {
                return <InvokeViz invoke={invokeDef} key={i} />;
              })}
            </div>
          )}
          {stateNode.onExit.length > 0 && (
            <div data-xviz="actions" data-xviz-actions="exit">
              {stateNode.onExit.map((exitAction, i) => {
                return <ActionViz action={exitAction} key={i} />;
              })}
            </div>
          )}
        </div>
        {Object.keys(stateNode.states).length > 0 && (
          <div data-xviz="stateNode-children">
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
      <div data-xviz="events">
        {edges.map(edge => {
          return (
            <EventViz edge={edge} key={serializeTransition(edge.transition)} />
          );
        })}
      </div>
    </div>
  );
}
