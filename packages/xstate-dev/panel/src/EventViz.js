import React from 'react';
import styled from 'styled-components';

const StyledEdgeViz = styled.div`
  display: inline-grid;
  grid-template-rows: 1rem auto;
`;

export const EventViz = ({ edge }) => {
  return (
    <StyledEdgeViz>
      <strong>{edge.eventType}</strong>
      <ul>
        {edge.actions.map((action, i) => {
          return <li key={i}>{action.type}</li>;
        })}
      </ul>
    </StyledEdgeViz>
  );
};
