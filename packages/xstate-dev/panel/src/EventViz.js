import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { tracker } from './tracker';
import { serializeEdge } from './App';

const StyledEdgeViz = styled.div`
  display: inline-grid;
  grid-template-rows: 1rem auto;

  ul,
  li {
    list-style: none;
    padding: 0;
    margin: 0;
  }
`;

export const EventViz = ({ edge }) => {
  const ref = useRef();

  useEffect(() => {
    if (ref.current) {
      tracker.update(serializeEdge(edge), ref.current);
    }
  });

  return (
    <StyledEdgeViz>
      <strong ref={ref}>{edge.eventType}</strong>
      <ul>
        {edge.actions.map((action, i) => {
          return <li key={i}>{action.type}</li>;
        })}
      </ul>
    </StyledEdgeViz>
  );
};
