if (!global._babelPolyfill) {
  require('babel-core/polyfill');
}

import machine from './dfa';

export {
  machine
};
