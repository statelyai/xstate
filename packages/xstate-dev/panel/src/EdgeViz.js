import React, { useState, useEffect } from 'react';
import { tracker } from './tracker';

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
  const [sourceRect, setSourceRect] = useState();
  const [targetRect, setTargetRect] = useState();
  const [svgRect, setSvgRect] = useState();

  const targets = edge.target || [];
  const source = edge.source;

  useEffect(() => {
    if (!targets.length) {
      return;
    }
    tracker.listen(source.id, setSourceRect);
    tracker.listen(targets[0].id, setTargetRect);
    tracker.listen('svg', setSvgRect);
  }, []);

  if (!sourceRect || !targetRect || !svgRect) {
    return null;
  }

  const sourcePos = relative(
    sourceRect.element.getBoundingClientRect(),
    svgRect.element
  );
  const targetPos = relative(
    targetRect.element.getBoundingClientRect(),
    svgRect.element
  );

  const startPoint = [sourcePos.left, sourcePos.top];
  const endPoint = [targetPos.left, targetPos.top];

  return (
    <path
      d={`M${startPoint[0]}, ${startPoint[1]} L ${endPoint[0]}, ${endPoint[1]}`}
      stroke="red"
    ></path>
  );
};

console.log(tracker);
