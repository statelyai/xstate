import * as React from 'react';
import { useContext, useRef } from 'react';
import { Edge } from './types';
import { StateContext } from './StateContext';
import { Point } from './Rect';
import { serializeTransition, isActive, getPartialStateValue } from './utils';
import { useTracked } from './useTracker';
import { flatten } from 'xstate/lib/utils';
import { roundOneCorner } from './pathUtils';

type Side = 'top' | 'left' | 'bottom' | 'right';

type PointFn = (p: Point) => Point & { radius?: number };

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

  const targetPointEntries = Object.entries(targetPoints) as Array<
    [Side, Point]
  >;

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

export function EdgeViz({
  edge,
  markerId,
  index
}: {
  edge: Edge<any, any>;
  markerId: string;
  index: number;
}) {
  const { state } = useContext(StateContext);
  const isCurrent = isActive(state, edge.source);
  const ref = useRef<SVGGElement>(null);
  const sourceRectData = useTracked(edge.source.id);
  const sourceRect = sourceRectData ? sourceRectData.rect : undefined;
  const sourceEventsRectData = useTracked(edge.source.id + ':events');
  const sourceEventsRect = sourceEventsRectData
    ? sourceEventsRectData.rect
    : undefined;

  const eventRectData = useTracked(serializeTransition(edge.transition));
  const eventRect = eventRectData ? eventRectData.rect : undefined;

  const targetRectData = useTracked(edge.target.id);
  const targetRect = targetRectData ? targetRectData.rect : undefined;
  const targetEventsRectData = useTracked(edge.target.id + ':events');
  const targetEventsRect = targetEventsRectData
    ? targetEventsRectData.rect
    : undefined;

  const triggered =
    state.event.type === edge.event &&
    state.history?.matches(getPartialStateValue(edge.source));

  const path =
    !sourceRect ||
    !sourceEventsRect ||
    !eventRect ||
    !targetRect ||
    !targetEventsRect ||
    !ref.current
      ? null
      : (() => {
          if (edge.source === edge.target) {
            return null;
          }
          const relativeSourceRect = sourceRect;
          const relativeEventRect = eventRect;

          const relativeTargetRect = targetRect;

          let startPoint = relativeEventRect.point('right', 'center');
          startPoint = { x: startPoint.x + 10, y: startPoint.y };
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

          const xdir = Math.sign(endPoint.x - startPoint.x);
          const ydir = Math.sign(endPoint.y - startPoint.y);

          const preEndPoint = {
            x: endPoint.x + endOffset.x,
            y: endPoint.y + endOffset.y
          };

          const bendPoints = flatten<PointFn | undefined>(
            [
              xdir === -1
                ? minLocation === 'top' && ydir === -1
                  ? [
                      (p) => ({
                        x: p.x,
                        y: Math.min(
                          endPoint.y + endOffset.y,
                          sourceEventsRect.top
                        ),
                        radius: 10
                      })
                      // `L ${sourceEventsRect.left} ${sourceEventsRect.top}`
                    ]
                  : [
                      (p) => ({
                        x: p.x,
                        y: Math.max(
                          endPoint.y + endOffset.y,
                          sourceEventsRect.bottom
                        ),
                        radius: 10
                      }),
                      (p) => ({
                        x: sourceEventsRect.left,
                        y: Math.max(
                          endPoint.y + endOffset.y,
                          sourceEventsRect.bottom
                        ),
                        radius: 10
                      })
                    ]
                : minLocation === 'bottom'
                ? (p) => ({ x: preEndPoint.x, y: p.y })
                : minLocation === 'left'
                ? (p) => ({ x: preEndPoint.x, y: p.y })
                : undefined,

              xdir === -1 &&
              minLocation === 'bottom' &&
              targetEventsRect.bottom > endPoint.y
                ? [
                    (p) => ({
                      x: targetEventsRect.right,
                      y: Math.max(endPoint.y, targetEventsRect.bottom),
                      radius: 10
                    }),
                    (p) => ({
                      x: endPoint.x,
                      y: Math.max(endPoint.y, targetEventsRect.bottom),
                      radius: 10
                    })
                  ]
                : undefined
            ].filter((x) => !!x)
          ) as PointFn[];

          const d = ([
            () => sourcePoint,
            () => preStartPoint,
            () => ({ ...startPoint, radius: 10 }),
            ...bendPoints,

            () => ({
              x: endPoint.x + endOffset.x,
              y: endPoint.y + endOffset.y
            }),
            () => endPoint
          ].filter((x) => !!x) as PointFn[])
            .reduce(
              (acc, bpfn) => {
                const prevPoint = acc[acc.length - 1];

                return acc.concat(bpfn(prevPoint));
              },
              [startPoint as Point & { radius?: number }]
            )
            .map((pt, i, pts) => {
              return `${i ? 'L' : 'M'} ${pt.x} ${pt.y}`;
            })
            .join(' ');

          // const d = [
          //   `M ${sourcePoint.x} ${sourcePoint.y}`,
          //   `L ${preStartPoint.x} ${preStartPoint.y}`,

          //   `M ${startPoint.x} ${startPoint.y}`,
          //   // `L ${startPoint.x + 10} ${startPoint.y}`,
          //   `C ${startControl.x} ${startControl.y} ${endControl.x} ${
          //     endControl.y
          //   } ${endPoint.x + endOffset.x} ${endPoint.y + endOffset.y}`
          // ]
          //   .filter((x) => !!x)
          //   .join(' ');

          return (
            <>
              <path
                data-xviz="edge-path"
                d={d}
                fill="none"
                markerEnd={`url(#${markerId})`}
                pathLength={1}
                strokeLinejoin="round"
              />
              <path
                data-xviz="edge-path"
                data-xviz-secondary
                d={d}
                fill="none"
                pathLength={1}
                strokeLinejoin="round"
              />
            </>
          );
        })();

  return (
    <g
      data-xviz="edge"
      data-xviz-current={isCurrent || undefined}
      data-xviz-triggered={triggered || undefined}
      data-source={JSON.stringify(sourceRect)}
      ref={ref}
    >
      {path}
    </g>
  );
}
