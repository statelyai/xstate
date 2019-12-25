import React, { useState, useEffect } from 'react';
import { tracker } from './tracker';
import { serializeEdge } from './App';

export function relative(childRect, parentElement) {
  const parentRect = parentElement.getBoundingClientRect();

  return {
    top: childRect.top - parentRect.top,
    right: childRect.right - parentRect.left,
    bottom: childRect.bottom - parentRect.top,
    left: childRect.left - parentRect.left,
    width: childRect.width,
    height: childRect.height
  };
}

export const EdgeViz = ({ edge }) => {
  console.log('EDGE', edge);
  const [eventRect, setEventRect] = useState();
  const [targetRect, setTargetRect] = useState();
  const [svgRect, setSvgRect] = useState();

  const targets = edge.target || [];

  useEffect(() => {
    if (!targets.length) {
      return;
    }
    console.log('listening', edge.source.id, targets);
    tracker.listen(serializeEdge(edge), setEventRect);
    tracker.listen(targets[0].id, setTargetRect);
    tracker.listen('svg', setSvgRect);
  }, []);

  console.log('listen update', edge.source.id, eventRect, targetRect, svgRect);

  if (!eventRect || !targetRect || !svgRect) {
    return null;
  }

  const eventPos = relative(eventRect.rect, svgRect.element);
  const targetPos = relative(targetRect.rect, svgRect.element);

  const yDir = Math.sign(targetPos.top - eventPos.top);

  const startPoint = [eventPos.right, eventPos.top + eventPos.height / 2];
  const endPoint = [
    targetPos.left + targetPos.width / 2,
    yDir === -1 ? targetPos.bottom : targetPos.top
  ];

  const points = [
    startPoint,
    [startPoint[0] + 10, startPoint[1]],
    [startPoint[0] + 10, (endPoint[1] - startPoint[1]) / 2 + startPoint[1]],
    [endPoint[0], (endPoint[1] - startPoint[1]) / 2 + startPoint[1]],
    endPoint
  ];

  const d = points.reduce((acc, pt, i) => {
    if (i === 0) {
      return `M${pt[0]}, ${pt[1]}`;
    }
    return acc + ` L${pt[0]}, ${pt[1]}`;
  }, '');

  return <path d={d} stroke="white" strokeWidth={2} fill="none"></path>;
};

console.log(tracker);
