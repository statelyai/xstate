import React from 'react';
import JSONTree from 'react-json-tree';
import { stringify } from 'javascript-stringify';

import createStylingFromTheme from './utils/createStylingFromTheme';
import getItemString from './utils/getItemString';

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

const isWideLayout = true;

const invertTheme = false;

const themeName = 'nicinabox'

const expandFirstLevel = (keyName, data, level) => level <= 1;

function stringifyAndShrink(val, isWideLayout) {
  if (val === null) { return 'null'; }

  const str = stringify(val);
  if (typeof str === 'undefined') { return 'undefined'; }

  if (isWideLayout) return str.length > 42 ? str.substr(0, 30) + '…' + str.substr(-10) : str;
  return str.length > 22 ? `${str.substr(0, 15)}…${str.substr(-5)}` : str;
}

function prepareDelta(value) {
  if (value && value._t === 'a') {
    const res = {};
    for (let key in value) {
      if (key !== '_t') {
        if (key[0] === '_' && !value[key.substr(1)]) {
          res[key.substr(1)] = value[key];
        } else if (value['_' + key]) {
          res[key] = [value['_' + key][0], value[key][0]];
        } else if (!value['_' + key] && key[0] !== '_') {
          res[key] = value[key];
        }
      }
    }
    return res;
  }

  return value;
}

const valueRenderer = (raw, value) => {

  function renderSpan(name, body) {
    return (
      <span key={name}>{body}</span>
    );
  }

  if (Array.isArray(value)) {
    switch(value.length) {
    case 1:
      return (
        <span>
          {renderSpan('diffAdd', stringifyAndShrink(value[0], isWideLayout))}
        </span>
      );
    case 2:
      return (
        <span>
          {renderSpan('diffUpdateFrom', stringifyAndShrink(value[0], isWideLayout))}
          {renderSpan('diffUpdateArrow', ' => ')}
          {renderSpan('diffUpdateTo', stringifyAndShrink(value[1], isWideLayout))}
        </span>
      );
    case 3:
      return (
        <span>
          {renderSpan('diffRemove', stringifyAndShrink(value[0]))}
        </span>
      );
    }
  }

  return raw;
}

export const DATA_TYPE_KEY = Symbol.for('__serializedType__');

const _getItemString = (type, data) => (
  getItemString(
    undefined, type, data, DATA_TYPE_KEY, isWideLayout, true
  )
)


/* valueRenderer
(raw, value) => {
      console.log('valueRenderer: raw:', raw, 'value:', value);
      console.log('typeof raw', typeof raw)
      console.log('typeof value', typeof value)
      return <strong>{raw}</strong>
    }
*/

const JSONDiff = ({diffData}) => {
  return (
    <JSONTree
    theme={theme}
    data={diffData}
    getItemString={_getItemString}
    valueRenderer={valueRenderer}
    postprocessValue={prepareDelta}
    isCustomNode={Array.isArray}
    shouldExpandNode={expandFirstLevel}
    hideRoot
    invertTheme
    />

  )
}

export default JSONDiff;