import * as React from 'react';
import { useState, useEffect, useContext, useRef } from 'react';
import { Edge } from './types';
import { StateContext } from './StateContext';
import { TrackerData, relative, Point } from './tracker';
import { serializeTransition } from './utils';

export function EdgeViz({ edge }: { edge: Edge<any, any> }) {
  const { tracker } = useContext(StateContext);
  const ref = useRef<SVGGElement>(null);
  const [sourceRect, setSourceRect] = useState<TrackerData | undefined>();
  const [targetRect, setTargetRect] = useState<TrackerData | undefined>();

  useEffect(() => {
    tracker.listen(serializeTransition(edge.transition), data =>
      setSourceRect(data)
    );
    tracker.listen(edge.target.id, data => setTargetRect(data));
  }, []);

  console.log({ c: ref.current, sourceRect, targetRect });

  const path =
    !sourceRect ||
    !targetRect ||
    !ref.current ||
    !sourceRect.rect ||
    !targetRect.rect
      ? null
      : (() => {
          if (edge.source === edge.target) {
            return null;
          }
          const relativeSourceRect = relative(
            sourceRect.rect!,
            ref.current.ownerSVGElement!
          );

          const relativeTargetRect = relative(
            targetRect.rect!,
            ref.current.ownerSVGElement!
          );

          const startPoint = relativeSourceRect.point('right', 'center');

          const targetPoints = {
            top: relativeTargetRect.point('center', 'top'),
            bottom: relativeTargetRect.point('center', 'bottom'),
            left: relativeTargetRect.point('left', 'center'),
            right: relativeTargetRect.point('right', 'center')
          };
          const targetPointEntries = Object.entries(targetPoints);

          const [minLocation, minPoint] = targetPointEntries.reduce(
            (current, candidate) => {
              const [, currentMinPoint] = current;
              const [, point] = candidate;
              return Math.hypot(
                startPoint.x - point.x,
                startPoint.y - point.y
              ) <
                Math.hypot(
                  startPoint.x - currentMinPoint.x,
                  startPoint.y - currentMinPoint.y
                )
                ? candidate
                : current;
            },
            targetPointEntries[0]
          );

          const endPoint = minPoint;

          const endOffset: Point = ({
            top: { x: 0, y: -10 },
            bottom: { x: 0, y: 10 },
            left: { x: -10, y: 0 },
            right: { x: 10, y: 0 }
          } as Record<typeof minLocation, Point>)[minLocation];

          const d = [
            `M ${startPoint.x} ${startPoint.y}`,
            `L ${startPoint.x + 10} ${startPoint.y}`,
            `C ${startPoint.x + 30} ${startPoint.y} ${endPoint.x +
              endOffset.x * 3} ${endPoint.y + endOffset.y * 3} ${endPoint.x +
              endOffset.x} ${endPoint.y + endOffset.y}`,
            `L ${endPoint.x} ${endPoint.y}`
            // `Q  `
          ].join(' ');

          return <path d={d} stroke="black" fill="none" />;
        })();

  return (
    <g data-xviz-element="edge" ref={ref}>
      {path}
    </g>
  );
}
