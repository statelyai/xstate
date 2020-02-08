import React, { useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { getEdges } from './utils';
import { EventViz } from './EventViz';
import {
  getChildren,
  StyledStateNodeViz,
  StyledStateNodeState,
  StyledStateNodeChildrenViz,
  StyledStateNodeEvents,
  serializeEdge
} from './App';
import { tracker } from './tracker';

export const StateNodeViz = ({ stateNode, state }) => {
  const stateNodeRef = useRef(null);
  const childNodes = useMemo(() => {
    return getChildren(stateNode);
  }, []);
  const resolvedState = stateNode.machine.resolveState(state);
  const isActive = resolvedState.configuration.includes(stateNode);
  const edges = getEdges(stateNode, { depth: 0 });

  useEffect(() => {
    if (stateNodeRef.current) {
      tracker.update(stateNode.id, stateNodeRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    if (isActive && stateNodeRef.current && stateNode.type === 'atomic') {
      stateNodeRef.current.scrollIntoView({
        // behavior: 'smooth',
        block: 'center'
      });
      requestAnimationFrame(() => {
        tracker.update(stateNode.id, stateNodeRef.current);
      });
    }
  }, [isActive]);

  return (
    <StyledStateNodeViz
      data-active={isActive || undefined}
      data-type={stateNode.type}
    >
      <StyledStateNodeState ref={stateNodeRef}>
        <header>{stateNode.key}</header>
        {!!childNodes.length && (
          <StyledStateNodeChildrenViz>
            {childNodes.map(childNode => {
              return (
                <StateNodeViz
                  stateNode={childNode}
                  state={state}
                  key={childNode.id}
                />
              );
            })}
          </StyledStateNodeChildrenViz>
        )}
      </StyledStateNodeState>
      <StyledStateNodeEvents>
        {edges.map(edge => {
          const serial = serializeEdge(edge);

          return <EventViz edge={edge} key={serial}/>;
        })}
      </StyledStateNodeEvents>
    </StyledStateNodeViz>
  );
};
