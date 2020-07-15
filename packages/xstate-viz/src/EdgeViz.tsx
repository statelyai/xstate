import * as React from 'react';
import { useContext, useRef } from 'react';
import { Edge } from './types';
import { StateContext } from './StateContext';
import { Point } from './Rect';
import { serializeTransition, isActive, getPartialStateValue } from './utils';
import { useTracked } from './useTracker';
import { roundOneCorner } from './pathUtils';
import { StateNode } from 'xstate';

type Side = 'top' | 'left' | 'bottom' | 'right';

type PointFn = (p: Point) => Point | Point[] | undefined;

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
  markerId
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
          const offset = 10;

          const endOffset: Point = ({
            top: { x: 0, y: -20 },
            bottom: { x: 0, y: 20 },
            left: { x: -20, y: 0 },
            right: { x: 20, y: 0 }
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

          let bends: any = [];

          function isTargetChild(parent: StateNode, child: StateNode): boolean {
            let marker = child.parent;

            while (marker && marker !== parent) {
              marker = marker.parent;
            }

            return marker === parent;
          }

          const isInner = isTargetChild(edge.source, edge.target);
          const isSibling = edge.source.parent === edge.target.parent;

          if (isSibling) {
            // which direction?
            switch (xdir) {
              case -1:
                switch (ydir) {
                  case 1:
                    switch (minLocation) {
                      case 'right':
                        bends.push((pt) => ({
                          x: pt.x,
                          y: Math.max(pt.y + offset * ydir * 2, preEndPoint.y)
                        }));
                        break;
                      case 'top':
                        bends.push((pt) => {
                          return {
                            x: pt.x,
                            y: Math.max(
                              sourceRect.bottom + offset,
                              sourceEventsRect.bottom + offset,
                              preEndPoint.y
                            )
                          };
                        });
                        break;
                      default:
                        bends.push((pt) => ({
                          x: pt.x,
                          y: Math.max(
                            pt.y + offset * ydir * 2,
                            sourceRect.bottom + offset
                          )
                        }));
                        break;
                    }

                    break;

                  case -1:
                    switch (minLocation) {
                      case 'bottom':
                        if (preEndPoint.y < sourceRect.top) {
                          bends.push((pt) => {
                            return {
                              x: pt.x,
                              y: Math.min(
                                sourceRect.top - offset,
                                Math.max(
                                  targetEventsRect.bottom + offset,
                                  preEndPoint.y
                                )
                              )
                            };
                          });
                          bends.push((_pt) => {
                            if (preEndPoint.y < targetEventsRect.bottom) {
                              return [
                                {
                                  x: targetEventsRect.right + offset,
                                  y: targetEventsRect.bottom + offset
                                },
                                {
                                  x: preEndPoint.x,
                                  y: targetEventsRect.bottom + offset
                                }
                              ];
                            }
                          });
                        } else {
                          bends.push((pt) => {
                            const y =
                              Math.max(
                                sourceRect.bottom,
                                sourceEventsRect.bottom,
                                targetEventsRect.bottom
                              ) + offset;
                            return [
                              {
                                x: pt.x,
                                y
                              },
                              {
                                x: sourceRect.x,
                                y
                              }
                            ];
                          });

                          bends.push((pt) => {
                            if (targetEventsRect.bottom > preEndPoint.y) {
                              const y = Math.max(
                                pt.y,
                                targetEventsRect.bottom + offset
                              );
                              return [
                                {
                                  x: targetEventsRect.right + offset,
                                  y
                                },
                                {
                                  x: preEndPoint.x,
                                  y
                                }
                              ];
                            } else {
                              return {
                                x: preEndPoint.x,
                                y:
                                  Math.max(
                                    sourceRect.bottom,
                                    sourceEventsRect.bottom
                                  ) + offset
                              };
                            }
                          });
                        }
                        break;
                      case 'top':
                        bends.push((pt) => {
                          return {
                            x: pt.x,
                            y: Math.min(sourceRect.top - offset, preEndPoint.y)
                          };
                        });
                        break;
                      default:
                        break;
                    }
                    break;
                  default:
                    break;
                }
                break;
              case 1:
                switch (ydir) {
                  case -1:
                    bends.push((pt) => ({
                      x: preEndPoint.x,
                      y: pt.y
                    }));
                    break;

                  case 1:
                    bends.push((pt) => {
                      return {
                        x: preEndPoint.x,
                        y: pt.y
                      };
                    });
                    break;
                  case 0:
                    // TODO: if there are any state nodes between
                    if (preEndPoint.x - sourceEventsRect.right > 100) {
                      bends.push((pt) => {
                        return {
                          x: pt.x,
                          y: sourceEventsRect.top - offset
                        };
                      });
                      bends.push((pt) => {
                        return {
                          x: preEndPoint.x,
                          y: pt.y
                        };
                      });
                    }
                  default:
                    break;
                }
                break;
              default:
                break;
            }
          } else if (isInner) {
            switch (minLocation) {
              case 'bottom':
                bends.push((pt) => {
                  const y =
                    Math.max(sourceEventsRect.bottom, sourceRect.bottom) +
                    offset;

                  return {
                    x: pt.x,
                    y
                  };
                });

                bends.push((pt) => {
                  return {
                    x: preEndPoint.x,
                    y: pt.y
                  };
                });
                break;
              case 'top':
                bends.push((pt) => {
                  return {
                    x: pt.x,
                    y: sourceEventsRect.top - offset
                  };
                });
                bends.push((pt) => {
                  return {
                    x: preEndPoint.x,
                    y: pt.y
                  };
                });
              default:
                break;
            }
          } else {
            switch (xdir) {
              case -1:
                switch (ydir) {
                  case 1:
                    bends.push((pt) => ({
                      x: pt.x,
                      y: Math.max(
                        Math.max(sourceEventsRect.bottom, sourceRect.bottom) +
                          offset,
                        preEndPoint.y
                      )
                    }));

                    bends.push((pt) => {
                      return {
                        x: preEndPoint.x,
                        y: pt.y
                      };
                    });

                    break;
                  case 0:
                    break;
                  case -1:
                    bends.push((pt) => ({
                      x: pt.x,
                      y: Math.max(preEndPoint.y, targetEventsRect.bottom)
                    }));
                    break;
                  default:
                    break;
                }
                break;
              case 1:
                switch (ydir) {
                  case -1:
                    bends.push((pt) => ({
                      x: preEndPoint.x,
                      y: pt.y
                    }));
                    break;
                  case 0:
                    break;
                  case 1:
                    bends.push((pt) => {
                      return {
                        x: pt.x,
                        y: preEndPoint.y
                      };
                    });
                    break;
                  default:
                    break;
                }
                break;
              default:
                break;
            }
          }

          const points = ([
            () => sourcePoint,
            () => preStartPoint,
            () => startPoint,
            ...bends,
            () => preEndPoint,
            (pt) => {
              switch (minLocation) {
                case 'bottom':
                  return { x: pt.x, y: pt.y - 10 };
                case 'top':
                  return { x: pt.x, y: pt.y + 10 };
                case 'left':
                case 'right':
                default:
                  return { x: pt.x + xdir * 10, y: pt.y };
              }
            }
          ].filter((x) => !!x) as PointFn[]).reduce(
            (acc, bpfn) => {
              const prevPoint = acc[acc.length - 1];

              const nextPoint = bpfn(prevPoint);

              if (!nextPoint) {
                return acc;
              }

              return acc.concat(nextPoint);
            },
            [sourcePoint]
          );

          // simplify
          const simplifiedPoints = points.reduce((acc, point, i) => {
            if (i === 0) {
              acc.push(point);
              return acc;
            }

            const [p1, p2] = [point, points[i - 1]];

            if (p1.x === p2.x && p1.y === p2.y) {
              return acc;
            }

            acc.push(point);

            return acc;
          }, [] as Point[]);

          const circlePoints = [...simplifiedPoints];

          const roundCorners = true;

          const d = simplifiedPoints
            .map((pt, i, pts) => {
              if (roundCorners && i >= 2 && i <= pts.length - 2) {
                const { p1, p2, p } = roundOneCorner(
                  pts[i - 1],
                  pt,
                  pts[i + 1]
                );

                circlePoints.push(p1, p, p2);

                return `L ${p1.x} ${p1.y} C ${p1.x} ${p1.y}, ${p.x} ${p.y}, ${p2.x} ${p2.y}`;
              }
              return `${i ? 'L' : 'M'} ${pt.x} ${pt.y}`;
            })
            .join('\n');

          return (
            <>
              <path
                data-xviz="edge-path"
                d={d}
                fill="none"
                markerEnd={`url(#${markerId})`}
                pathLength={1}
                strokeLinejoin="round"
                data-xdir={xdir}
                data-ydir={ydir}
                data-minloc={minLocation}
              />
              <path
                data-xviz="edge-path"
                data-xviz-secondary
                d={d}
                fill="none"
                pathLength={1}
                strokeLinejoin="round"
              />
              {/* {circlePoints.map((pt, i) => {
                return <circle r={3} cx={pt.x} cy={pt.y} fill="red" key={i} />;
              })} */}
            </>
          );
        })();

  return (
    <g
      data-xviz="edge"
      data-xviz-current={isCurrent || undefined}
      data-xviz-triggered={triggered || undefined}
      data-source={edge.source.id}
      data-target={edge.target.id}
      data-event={edge.event}
      ref={ref}
    >
      {path}
    </g>
  );
}
