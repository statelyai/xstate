import React from 'react';

export const EdgeViz = ({ edge }) => {
  return (
    <div>
      <strong>{edge.eventType}</strong>
      {edge.actions.map((action, i) => {
        return <small key={i}>{action.type}</small>;
      })}
    </div>
  );
};
