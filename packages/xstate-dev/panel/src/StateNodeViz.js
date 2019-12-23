import React, { useMemo } from 'react';
import { getEdges } from './utils';
import { EdgeViz } from './EdgeViz';
import {
  getChildren,
  StyledStateNodeViz,
  StyledStateNodeState,
  StyledStateNodeChildrenViz,
  StyledStateNodeEvents
} from './App';

export const StateNodeViz = ({ stateNode, state }) => {
  console.log(stateNode, state);
  const childNodes = useMemo(() => {
    return getChildren(stateNode);
  }, []);
  const resolvedState = stateNode.machine.resolveState(state);
  const active = resolvedState.configuration.includes(stateNode);
  const edges = getEdges(stateNode, { depth: 0 });
  console.log(edges);
  return (
    <StyledStateNodeViz
      data-active={active || undefined}
      data-type={stateNode.type}
    >
      <StyledStateNodeState>
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
          return <EdgeViz edge={edge} />;
        })}
      </StyledStateNodeEvents>
    </StyledStateNodeViz>
  );
};
