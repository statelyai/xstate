import * as React from "react";
import { useContext, useRef } from "react";
import { Edge } from "./types";
import { StateContext } from "./StateContext";
import { Point } from "./Rect";
import { serializeTransition, isActive, getPartialStateValue } from "./utils";
import { useTracked } from "./useTracker";
import {
  roundOneCorner,
  simplifyPoints,
  isBendable,
  withMidpoints,
  resolvePoints,
} from "./pathUtils";
import { StateNode } from "xstate";
import { MachineRectMeasurements } from "./MachineMeasure";

type Side = "top" | "left" | "bottom" | "right";

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

// @ts-ignore
function isInitialState(stateNode: StateNode<any, any>): boolean {
  return stateNode.parent?.initial === stateNode.key;
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
    ...options,
  };
  const { padding, filter } = resolvedOptions;

  const clampedX = clamp(point.x, rect.left + padding, rect.right - padding);
  const clampedY = clamp(point.y, rect.top + padding, rect.bottom - padding);

  const targetPoints: Record<Side, Point> = {
    top: {
      x: clampedX,
      y: rect.top,
    },
    bottom: {
      x: clampedX,
      y: rect.bottom,
    },
    left: {
      x: rect.left,
      y: clampedY,
    },
    right: {
      x: rect.right,
      y: clampedY,
    },
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

  if (minLocation === "top" && minPoint.x === point.x) {
    minPoint.x -= 10;
  } else if (minLocation === "right" && minPoint.y === point.y) {
    minPoint.y -= 10;
  } else if (
    minLocation === "bottom" &&
    minPoint.x === point.x &&
    minPoint.y > point.y
  ) {
    minPoint.x -= 10;
  }

  return [minLocation, minPoint];
}

function isTargetChild(parent: StateNode, child: StateNode): boolean {
  let marker = child.parent;

  while (marker && marker !== parent) {
    marker = marker.parent;
  }

  return marker === parent;
}

export function EdgeViz({
  edge,
  markerId,
  index,
}: {
  edge: Edge<any, any>;
  markerId: string;
  index: number;
  measurements?: MachineRectMeasurements;
}) {
  const { state } = useContext(StateContext);
  const isCurrent = state ? isActive(state, edge.source) : undefined;
  const ref = useRef<SVGGElement>(null);
  const sourceRectData = useTracked(edge.source.id);
  const sourceRect = sourceRectData ? sourceRectData.rect : undefined;
  const sourceEventsRectData = useTracked(edge.source.id + ":events");
  const sourceEventsRect = sourceEventsRectData
    ? sourceEventsRectData.rect
    : undefined;

  const eventRectData = useTracked(serializeTransition(edge.transition));
  const eventRect = eventRectData ? eventRectData.rect : undefined;

  const targetRectData = useTracked(edge.target.id);
  const targetRect = targetRectData ? targetRectData.rect : undefined;
  const targetEventsRectData = useTracked(edge.target.id + ":events");
  const targetEventsRect = targetEventsRectData
    ? targetEventsRectData.rect
    : undefined;

  const triggered =
    !!state &&
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
          const offset = 10;

          let points: Point[] = [];

          let eventPoint: Point;
          let startPoint: Point;

          if (edge.source === edge.target && edge.transition.internal) {
            const bends: PointFn[] = [];

            const startPt = eventRect.point("left", "center");

            bends.push(() => {
              return startPt;
            });

            if (startPt.y > targetRect.bottom) {
              bends.push((pt) => {
                return [
                  { x: targetRect.right - offset, y: pt.y },
                  {
                    x: targetRect.right - offset,
                    y: targetRect.bottom + offset,
                  },
                ];
              });
            } else {
              bends.push((pt) => {
                return {
                  x: targetRect.right + offset,
                  y: pt.y,
                };
              });
            }

            points = resolvePoints(bends);
          } else {
            eventPoint = eventRect.point("right", "center", {
              command: "M",
            });

            startPoint = {
              x:
                index === 0
                  ? eventRect.right + offset
                  : sourceEventsRect.right + offset,
              y: eventPoint.y,
            };

            const [minLocation, minPoint] = findMinLocation(
              startPoint,
              targetRect,
              {
                padding: offset,
                filter: ([side]) => {
                  if (side === "right" && edge.target.transitions.length > 0) {
                    return false;
                  }

                  return true;
                },
              }
            );

            const endPoint = { ...minPoint, label: "end-point" };

            const endOffset: Point = ({
              top: { x: 0, y: -20 },
              bottom: { x: 0, y: 20 },
              left: { x: -20, y: 0 },
              right: { x: 20, y: 0 },
            } as Record<typeof minLocation, Point>)[minLocation];

            const sourcePoint: Point = {
              x: sourceRect.right,
              y: Math.min(sourceRect.bottom, startPoint.y),
              label: "source",
            };
            const preStartPoint = eventRect.point("left", "center");

            const xdir = Math.sign(endPoint.x - startPoint.x);
            const ydir = Math.sign(endPoint.y - startPoint.y);

            const preEndPoint: Point = {
              x: endPoint.x + endOffset.x,
              y: endPoint.y + endOffset.y,
              label: "pre-end",
            };

            const bends: PointFn[] = [];

            const isInner = isTargetChild(edge.source, edge.target);
            const isSibling = edge.source.parent === edge.target.parent;

            if (isSibling) {
              // which direction?
              switch (xdir) {
                case -1:
                  switch (ydir) {
                    case 1:
                      switch (minLocation) {
                        case "right":
                          bends.push((pt) => ({
                            x: pt.x,
                            y: Math.max(
                              sourceEventsRect.bottom + offset,
                              preEndPoint.y
                            ),
                          }));
                          bends.push((pt) => {
                            return {
                              x: preEndPoint.x,
                              y: pt.y,
                            };
                          });
                          break;
                        case "top":
                          bends.push((pt) => {
                            return {
                              x: pt.x,
                              y: Math.max(
                                sourceRect.bottom + offset,
                                sourceEventsRect.bottom + offset,
                                preEndPoint.y
                              ),
                            };
                          });
                          break;
                        case "bottom":
                          bends.push((pt) => ({
                            x: pt.x,
                            y:
                              Math.max(
                                sourceEventsRect.bottom,
                                sourceRect.bottom,
                                preEndPoint.y
                              ) + offset,
                          }));
                          bends.push((pt) => {
                            return {
                              x: preEndPoint.x,
                              y: pt.y,
                            };
                          });
                          break;
                        default:
                          bends.push((pt) => ({
                            x: pt.x,
                            y: Math.max(
                              pt.y + offset * ydir * 2,
                              sourceRect.bottom + offset
                            ),
                          }));
                          break;
                      }

                      break;

                    case -1:
                      switch (minLocation) {
                        case "bottom":
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
                                ),
                              };
                            });
                            bends.push((pt) => {
                              if (preEndPoint.y < targetEventsRect.bottom) {
                                return [
                                  {
                                    x: Math.min(
                                      targetEventsRect.right + offset,
                                      pt.x
                                    ),
                                    y: targetEventsRect.bottom + offset,
                                  },
                                  {
                                    x: preEndPoint.x,
                                    y: targetEventsRect.bottom + offset,
                                  },
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
                                  y,
                                },
                                {
                                  x: sourceRect.x,
                                  y,
                                },
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
                                    y,
                                  },
                                  {
                                    x: preEndPoint.x,
                                    y,
                                  },
                                ];
                              } else {
                                return {
                                  x: preEndPoint.x,
                                  y:
                                    Math.max(
                                      sourceRect.bottom,
                                      sourceEventsRect.bottom
                                    ) + offset,
                                };
                              }
                            });
                          }
                          break;
                        case "top":
                          bends.push((pt) => {
                            return {
                              x: pt.x,
                              y: Math.min(
                                sourceRect.top - offset,
                                preEndPoint.y
                              ),
                            };
                          });
                          break;
                        case "right":
                          bends.push((pt) => {
                            return {
                              x: pt.x,
                              y: sourceEventsRect.top - offset,
                            };
                          });
                          bends.push((pt) => {
                            return {
                              x: preEndPoint.x,
                              y: pt.y,
                            };
                          });
                          break;
                        default:
                          break;
                      }
                      break;
                    case 0:
                      bends.push((pt) => {
                        return {
                          x: pt.x,
                          y: sourceRect.top - offset,
                        };
                      });
                      bends.push((pt) => {
                        return {
                          x: preEndPoint.x,
                          y: pt.y,
                        };
                      });
                    default:
                      break;
                  }
                  break;
                case 1:
                  switch (ydir) {
                    case -1:
                      bends.push((pt) => ({
                        x: preEndPoint.x,
                        y: pt.y,
                      }));
                      break;

                    case 1:
                      bends.push((pt) => {
                        return {
                          x: preEndPoint.x,
                          y: pt.y,
                        };
                      });
                      break;
                    case 0:
                      // TODO: if there are any state nodes between
                      if (preEndPoint.x - sourceEventsRect.right > 100) {
                        bends.push((pt) => {
                          return {
                            x: pt.x,
                            y: sourceEventsRect.top - offset,
                          };
                        });
                        bends.push((pt) => {
                          return {
                            x: preEndPoint.x,
                            y: pt.y,
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
                case "bottom":
                  bends.push((pt) => {
                    const y =
                      Math.max(sourceEventsRect.bottom, sourceRect.bottom) +
                      offset;

                    return {
                      x: pt.x,
                      y,
                    };
                  });

                  bends.push((pt) => {
                    return {
                      x: preEndPoint.x,
                      y: pt.y,
                    };
                  });
                  break;
                case "top":
                  bends.push((pt) => {
                    return {
                      x: pt.x,
                      y: sourceEventsRect.top - offset,
                    };
                  });
                  bends.push((pt) => {
                    return {
                      x: preEndPoint.x,
                      y: pt.y,
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
                        ),
                      }));

                      bends.push((pt) => {
                        return {
                          x: preEndPoint.x,
                          y: pt.y,
                        };
                      });

                      break;
                    case 0:
                      break;
                    case -1:
                      switch (minLocation) {
                        case "top":
                          // avoid awkward bend
                          bends.push((pt) => {
                            return {
                              x: pt.x,
                              y: preEndPoint.y,
                            };
                          });
                          break;
                        default:
                          bends.push((pt) => ({
                            x: pt.x,
                            y: Math.max(
                              preEndPoint.y,
                              targetEventsRect.bottom + offset
                            ),
                          }));
                          bends.push((pt) => ({
                            x: preEndPoint.x,
                            y: pt.y,
                          }));
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
                      switch (minLocation) {
                        default:
                          bends.push((pt) => ({
                            x: preEndPoint.x,
                            y: pt.y,
                          }));
                          break;
                      }

                    case 0:
                      break;
                    case 1:
                      bends.push((pt) => {
                        return {
                          x: pt.x,
                          y: preEndPoint.y,
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

            points = resolvePoints(
              [
                () => sourcePoint,
                (pt) => {
                  if (pt.y === preStartPoint.y) {
                    return preStartPoint;
                  }

                  return [{ x: pt.x, y: preStartPoint.y }, preStartPoint];
                },
                () => eventPoint,
                () => startPoint,
                ...bends,
                () => preEndPoint,
                (pt) => {
                  switch (minLocation) {
                    case "bottom":
                      return { x: pt.x, y: pt.y - offset };
                    case "top":
                      return { x: pt.x, y: pt.y + offset };
                    case "left":
                      return { x: pt.x + offset, y: pt.y };
                    case "right":
                      return { x: pt.x - offset, y: pt.y };
                    default:
                      return pt;
                  }
                },
              ],
              sourcePoint
            );
          }

          const pointsWithMid: Point[] = withMidpoints(simplifyPoints(points));

          const circlePoints = [...pointsWithMid];

          const roundCorners = true;

          const d = pointsWithMid
            .map((pt, i, pts) => {
              if (
                roundCorners &&
                i >= 2 &&
                i <= pts.length - 2 &&
                isBendable(pts[i - 1], pt, pts[i + 1])
              ) {
                const { p1, p2, p } = roundOneCorner(
                  pts[i - 1],
                  pt,
                  pts[i + 1]
                );

                circlePoints.push(
                  ...[p1, p2].map((p) => ({ ...p, color: "yellow" }))
                );

                return `L ${p1.x} ${p1.y} C ${p1.x} ${p1.y}, ${p.x} ${p.y}, ${p2.x} ${p2.y}`;
              }
              const command = pt.command || (i === 0 ? "M" : "L");
              return `${command} ${pt.x} ${pt.y}`;
            })
            .join("\n");

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
              {circlePoints.map((pt, i) => {
                return (
                  <circle
                    data-label={pt.label}
                    style={{ opacity: 0.5 }}
                    r={1}
                    cx={pt.x}
                    cy={pt.y}
                    fill={pt.color || "red"}
                    key={i}
                  />
                );
              })}
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
