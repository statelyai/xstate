import React from 'react';
import { Iterable } from 'immutable';
import isIterable from './isIterable';

const IS_IMMUTABLE_KEY = '@@__IS_IMMUTABLE__@@';

function isImmutable(value) {
  return Iterable.isKeyed(value) || Iterable.isIndexed(value) || Iterable.isIterable(value);
}

function getShortTypeString(val, diff) {
  if (diff && Array.isArray(val)) {
    val = val[val.length === 2 ? 1 : 0];
  }

  if (isIterable(val) && !isImmutable(val)) {
    return '(…)';
  } else if (Array.isArray(val)) {
    return val.length > 0 ? '[…]' : '[]';
  } else if (val === null) {
    return 'null';
  } else if (val === undefined) {
    return 'undef';
  } else if (typeof val === 'object') {
    return Object.keys(val).length > 0 ? '{…}' : '{}';
  } else if (typeof val === 'function') {
    return 'fn';
  } else if (typeof val === 'string') {
    return `"${val.substr(0, 10) + (val.length > 10 ? '…' : '')}"`
  } else if (typeof val === 'symbol') {
    return 'symbol'
  } else {
    return val;
  }
}

function getText(type, data, isWideLayout, isDiff) {
  if (type === 'Object') {
    const keys = Object.keys(data);
    if (!isWideLayout) return keys.length ? '{…}' : '{}';

    const str = keys
      .slice(0, 3)
      .map(key => `${key}: ${getShortTypeString(data[key], isDiff)}`)
      .concat(keys.length > 3 ? ['…'] : [])
      .join(', ');

    return `{ ${str} }`;
  } else if (type === 'Array') {
    if (!isWideLayout) return data.length ? '[…]' : '[]';

    const str = data
      .slice(0, 4)
      .map(val => getShortTypeString(val, isDiff))
      .concat(data.length > 4 ? ['…'] : []).join(', ');

    return `[${str}]`;
  } else {
    return type;
  }
}

const getItemString = (styling, type, data, dataTypeKey, isWideLayout, isDiff) =>
  <span>
    {data[IS_IMMUTABLE_KEY] ? 'Immutable' : ''}
    {dataTypeKey && data[dataTypeKey] ? data[dataTypeKey] + ' ' : ''}
    {getText(type, data, isWideLayout, isDiff)}
  </span>;

export default getItemString;
