import React from 'react';
import JSONTree from 'react-json-tree';

export function StateViz({ state }) {
  if (!state) {
    return null;
  }
  return <JSONTree data={state.context} hideRoot={true} />;
}
