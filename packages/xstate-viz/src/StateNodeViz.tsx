import * as React from 'react';
import { useContext, useMemo } from 'react';
import { StateContext } from './StateContext';
import { StateNode } from 'xstate';
import { EventViz } from './EventViz';
import { getEdges, serializeTransition, isActive, getLevel } from './utils';
import { ActionViz } from './ActionViz';
import { InvokeViz } from './InvokeViz';

import { useTracking } from './useTracker';
import ReactMarkdown from 'react-markdown';

interface StateNodeVizProps {
  stateNode: StateNode<any, any, any>;
}

export function StateNodeViz({ stateNode }: StateNodeVizProps) {
  const { state, service, selection } = useContext(StateContext);
  const ref = useTracking(stateNode.id);
  const eventsRef = useTracking(stateNode.id + ':events');

  const edges = useMemo(() => getEdges(stateNode), [stateNode]);
  const active = state ? isActive(state, stateNode) : false;
  const isSelected = selection.includes(stateNode);

  const titleDescriptor =
    stateNode.type === 'final'
      ? 'final'
      : stateNode.type === 'history'
      ? stateNode.history === 'deep'
        ? 'deep history'
        : 'history'
      : undefined;

  return (
    <div
      data-xviz="stateNode"
      data-xviz-id={stateNode.id}
      data-xviz-type={stateNode.type}
      data-xviz-parent-type={
        stateNode.parent ? stateNode.parent.type : 'machine'
      }
      data-xviz-history={stateNode.history || undefined}
      data-xviz-active={active || undefined}
      data-xviz-selected={isSelected || undefined}
      data-xviz-level={getLevel(stateNode)}
      data-xviz-order={stateNode.order}
      data-xviz-transitions={stateNode.transitions.length}
      title={`#${stateNode.id} ${
        titleDescriptor ? `(${titleDescriptor})` : ''
      }`}
      style={{
        // @ts-ignore
        '--xviz-level': getLevel(stateNode)
      }}
      onClick={(e) => {
        e.stopPropagation();
        service.send({
          type: 'stateNode.tap',
          stateNodeId: stateNode.id
        });
      }}
    >
      <div data-xviz="stateNode-state" ref={ref}>
        <div data-xviz="stateNode-content">
          <div data-xviz="stateNode-key">{stateNode.key}</div>
          <div data-xviz="stateNode-description">
            {stateNode.meta?.description && (
              <ReactMarkdown source={stateNode.meta.description} />
            )}
          </div>
          {stateNode.onEntry.length > 0 && (
            <div data-xviz="actions" data-xviz-actions="entry">
              {stateNode.onEntry.map((entryAction, i) => {
                return (
                  <ActionViz
                    action={entryAction}
                    state={active ? state : undefined}
                    key={i}
                  />
                );
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
            {Object.keys(stateNode.states).map((key) => {
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
      <div data-xviz="events" ref={eventsRef}>
        {edges.map((edge, i) => {
          return (
            <EventViz
              edge={edge}
              key={serializeTransition(edge.transition) + i}
              index={i}
            />
          );
        })}
      </div>
    </div>
  );
}
