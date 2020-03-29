import * as React from 'react';

export function ArrowMarker() {
  return (
    <marker
      id="marker"
      viewBox="0 0 10 10"
      markerWidth="5"
      markerHeight="5"
      refX="0"
      refY="5"
      markerUnits="strokeWidth"
      orient="auto"
    >
      <path d="M0,0 L0,10 L10,5 z" fill="currentColor" />
    </marker>
  );
}
