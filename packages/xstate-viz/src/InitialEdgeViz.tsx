import * as React from 'react';
import { Point } from './Rect';
import { useTracked } from './useTracker';
import { StateNode } from 'xstate';

export function InitialEdgeViz({
  stateNode,
  markerId
}: {
  stateNode: StateNode<any, any, any>;
  markerId: string;
}) {
  const data = useTracked(stateNode.id);

  if (!data) {
    return null;
  }

  const { left, top } = data.rect!;

  const endPoint: Point = {
    x: left - 10,
    y: top + 10
  };

  const startPoint: Point = {
    x: endPoint.x - 5,
    y: endPoint.y - 10
  };

  return (
    <g data-xviz="initialEdge">
      <circle
        data-xviz="initialEdge-circle"
        r="4"
        cx={startPoint.x}
        cy={startPoint.y}
        fill="currentColor"
      />
      <path
        data-xviz="initialEdge-path"
        d={`M ${startPoint.x},${startPoint.y} Q ${startPoint.x},${endPoint.y} ${
          endPoint.x
        },${endPoint.y} L ${endPoint.x + 1}, ${endPoint.y}`}
        stroke={'currentColor'}
        fill="none"
        markerEnd={`url(#${markerId})`}
        pathLength={1}
      />
    </g>
  );
}
