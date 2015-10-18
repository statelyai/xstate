if (!global._babelPolyfill) {
  require('babel-core/polyfill');
}

import machine from './dfa';
import stateReducer from './state-reducer'

export {
  machine,
  stateReducer
};
