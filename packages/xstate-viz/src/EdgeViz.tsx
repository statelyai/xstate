import * as React from 'react';
import { useState, useEffect, useContext, useRef } from 'react';
import { Edge } from './types';
import { StateContext } from './StateContext';
import { TrackerData, relative, Point } from './tracker';
import { serializeTransition, isActive } from './utils';
import { useTracked } from './useTracker';
import { StateNode } from 'xstate';

type Side = 'top' | 'left' | 'bottom' | 'right';

function clamp(x: number, min: number, max: number): number {
  if (x < min) {
    return min;
  }
  if (x > max) {
    return max;
  }
  return x;
}

function findMinLocation(
  point: Point,
  rect: ClientRect,
  options?: Partial<{
    padding: number;
    filter: (value: [Side, Point]) => boolean;
  }>
): [Side, Point] {
  const resolvedOptions = {
    padding: 0,
    filter: () => true,
    ...options
  };
  const { padding, filter } = resolvedOptions;

  const clampedX = clamp(point.x, rect.left + padding, rect.right - padding);
  const clampedY = clamp(point.y, rect.top + padding, rect.bottom - padding);

  const targetPoints: Record<Side, Point> = {
    top: {
      x: clampedX,
      y: rect.top
    },
    bottom: {
      x: clampedX,
      y: rect.bottom
    },
    left: {
      x: rect.left,
      y: clampedY
    },
    right: {
      x: rect.right,
      y: clampedY
    }
  };

  const targetPointEntries = Object.entries(targetPoints) as [Side, Point][];

  const [minLocation, minPoint] = targetPointEntries.reduce(
    (current, candidate) => {
      const [, currentMinPoint] = current;
      const [side, candidatePoint] = candidate;

      if (filter && !filter([side, candidatePoint])) {
        return current;
      }

      return Math.hypot(
        point.x - candidatePoint.x,
        point.y - candidatePoint.y
      ) < Math.hypot(point.x - currentMinPoint.x, point.y - currentMinPoint.y)
        ? candidate
        : current;
    },
    targetPointEntries[0]
  );

  return [minLocation, minPoint];
}

export function EdgeViz({ edge }: { edge: Edge<any, any> }) {
  const { state } = useContext(StateContext);
  const isCurrent = isActive(state, edge.source);
  const ref = useRef<SVGGElement>(null);
  const sourceRectData = useTracked(edge.source.id);
  const sourceRect = sourceRectData ? sourceRectData.rect : undefined;

  const eventRectData = useTracked(serializeTransition(edge.transition));
  const eventRect = eventRectData ? eventRectData.rect : undefined;

  const targetRectData = useTracked(edge.target.id);
  const targetRect = targetRectData ? targetRectData.rect : undefined;

  const machineRectData = useTracked(`machine:${edge.target.machine.id}`);
  const machineRect = machineRectData ? machineRectData.rect : undefined;

  const path =
    !sourceRect || !eventRect || !targetRect || !ref.current || !machineRect
      ? null
      : (() => {
          if (edge.source === edge.target) {
            return null;
          }
          const relativeSourceRect = relative(sourceRect, machineRect);
          const relativeEventRect = relative(eventRect!, machineRect);

          const relativeTargetRect = relative(targetRect, machineRect);

          const startPoint = relativeEventRect.point('right', 'center');
          const [minLocation, minPoint] = findMinLocation(
            startPoint,
            relativeTargetRect,
            {
              padding: 10,
              filter: ([side]) => {
                if (side === 'right' && edge.target.transitions.length > 0) {
                  return false;
                }

                return true;
              }
            }
          );

          const endPoint = minPoint;

          const endOffset: Point = ({
            top: { x: 0, y: -10 },
            bottom: { x: 0, y: 10 },
            left: { x: -10, y: 0 },
            right: { x: 10, y: 0 }
          } as Record<typeof minLocation, Point>)[minLocation];

          const startControl: Point = ({
            top: {
              x:
                startPoint.x +
                clamp((endPoint.x - startPoint.x) / 2, 40, Infinity),
              y: startPoint.y
            },
            bottom: {
              x: startPoint.x + 50,
              y: startPoint.y
            },
            left: {
              x:
                startPoint.x +
                clamp((endPoint.x - startPoint.x) / 2, 10, Infinity),
              y: startPoint.y
            },
            right: {
              x: startPoint.x + 50,
              y: startPoint.y
            }
          } as Record<typeof minLocation, Point>)[minLocation];

          const endControl: Point = ({
            top: {
              x: endPoint.x + endOffset.x * 3,
              y: Math.min(
                endPoint.y - (endPoint.y - startPoint.y) / 2,
                endPoint.y - 40
              )
            },
            bottom: {
              x: endPoint.x + endOffset.x * 3,
              y: endPoint.y + endOffset.y * 3
            },
            left: {
              x: endPoint.x - (endPoint.x - startPoint.x) / 2,
              y: endPoint.y + endOffset.y * 3
            },
            right: {
              x: endPoint.x + (startPoint.x - endPoint.x) / 2,
              y: endPoint.y + endOffset.y * 3
            }
          } as Record<typeof minLocation, Point>)[minLocation];

          const sourcePoint = {
            x: relativeSourceRect.right,
            y: Math.min(relativeSourceRect.bottom, startPoint.y)
          };
          const preStartPoint = relativeEventRect.point('left', 'center');

          const d = [
            `M ${sourcePoint.x} ${sourcePoint.y}`,
            `L ${preStartPoint.x} ${preStartPoint.y}`,

            `M ${startPoint.x} ${startPoint.y}`,
            // `L ${startPoint.x + 10} ${startPoint.y}`,
            `C ${startControl.x} ${startControl.y} ${endControl.x} ${
              endControl.y
            } ${endPoint.x + endOffset.x} ${endPoint.y + endOffset.y}`
          ].join(' ');

          return (
            <path
              data-xviz="edge-path"
              d={d}
              fill="none"
              markerEnd={`url(#marker)`}
            />
          );
        })();

  return (
    <g data-xviz="edge" data-xviz-current={isCurrent || undefined} ref={ref}>
      {path}
    </g>
  );
}

export function InitialEdgeViz({
  stateNode
}: {
  stateNode: StateNode<any, any, any>;
}) {
  const data = useTracked(stateNode.id);
  const machineData = useTracked(`machine:${stateNode.machine.id}`);

  if (!data) {
    return null;
  }

  const { left, top } = relative(data.rect!, machineData!.rect!);

  const endPoint: Point = {
    x: left - 10,
    y: top + 10
  };

  const startPoint: Point = {
    x: endPoint.x - 5,
    y: endPoint.y - 10
  };

  return (
    <g>
      <circle r="4" cx={startPoint.x} cy={startPoint.y} fill="currentColor" />
      <path
        d={`M ${startPoint.x},${startPoint.y} Q ${startPoint.x},${endPoint.y} ${
          endPoint.x
        },${endPoint.y} L ${endPoint.x + 1}, ${endPoint.y}`}
        stroke={'currentColor'}
        strokeWidth="2"
        fill="none"
        markerEnd={`url(#marker)`}
      />
    </g>
  );
}
