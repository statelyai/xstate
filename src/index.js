if (!global._babelPolyfill) {
  require('babel-core/polyfill');
}

import _ from 'lodash';
import Machine from './lib/machine';

export default function machine(data) {
  return new Machine(data);
}
