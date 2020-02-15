import React, { useState, useEffect } from 'react';
import { tracker } from './tracker';
import { serializeEdge } from './App';
import { pathToStateValue } from 'xstate/lib/utils';
import styled from 'styled-components';

export function relative(childRect, parentRect) {
  // const parentRect = parentElement.getBoundingClientRect();

  return {
    top: childRect.top - parentRect.top,
    right: childRect.right - parentRect.left,
    bottom: childRect.bottom - parentRect.top,
    left: childRect.left - parentRect.left,
    width: childRect.width,
    height: childRect.height
  };
}

const StyledPath = styled.path`
  opacity: 0.5;
  &[data-enabled] {
    opacity: 1;
  }
`;

export const EdgeViz = ({ edge, state }) => {
  const [eventRect, setEventRect] = useState();
  const [targetRect, setTargetRect] = useState();
  const [svgRect, setSvgRect] = useState();
  console.log(state);
  const targets = edge.target || [];

  useEffect(() => {
    if (!targets.length) {
      return;
    }

    tracker.listen(serializeEdge(edge), data => {
      setEventRect(data);
    });
    tracker.listen(targets[0].id, data => {
      setTargetRect(data);
    });
    tracker.listen('svg', data => {
      setSvgRect(data);
    });
  }, []);

  if (!eventRect || !targetRect || !svgRect) {
    return null;
  }

  const eventPos = relative(eventRect.rect, svgRect.rect);
  const targetPos = relative(targetRect.rect, svgRect.rect);

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

  return (
    <StyledPath
      d={d}
      stroke="white"
      strokeWidth={2}
      fill="none"
      data-enabled={
        state.matches(pathToStateValue(edge.source.path)) || undefined
      }
    ></StyledPath>
  );
};

console.log(tracker);
