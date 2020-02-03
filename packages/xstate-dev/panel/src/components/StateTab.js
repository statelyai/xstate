import React from 'react';
import JSONTree from 'react-json-tree';
import formatFiniteState from '../utils/formatFiniteState';

const theme = {
  scheme: 'monokai',
  author: 'wimer hazenberg (http://www.monokai.nl)',
  base00: '#272822',
  base01: '#383830',
  base02: '#49483e',
  base03: '#75715e',
  base04: '#a59f85',
  base05: '#f8f8f2',
  base06: '#f5f4f1',
  base07: '#f9f8f5',
  base08: '#f92672',
  base09: '#fd971f',
  base0A: '#f4bf75',
  base0B: '#a6e22e',
  base0C: '#a1efe4',
  base0D: '#66d9ef',
  base0E: '#ae81ff',
  base0F: '#cc6633'
};

const FlattenedFiniteState = ({ finiteState }) => {
  const formattedFiniteState = formatFiniteState(finiteState)

  if (typeof formattedFiniteState === 'string') {
    return (<h2>{formattedFiniteState}</h2>)
  } else if (typeof formattedFiniteState === 'object') {
    return (
      <JSONTree data={{ formattedFiniteState }} theme={theme} invertTheme hideRoot={true} />
    )
  }
}

function StateTab({ finiteState,  extendedState}) {
  if (!finiteState || !extendedState) {
    return null;
  }

  return (
    <>
      <h1>Finite</h1>
      <FlattenedFiniteState finiteState={finiteState} />
      <h1>Extended</h1>
      <JSONTree data={extendedState} theme={theme} invertTheme hideRoot={true} />
    </>
  )
}

export default StateTab