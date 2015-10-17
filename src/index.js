if (!global._babelPolyfill) {
  require('babel-core/polyfill');
}

import _ from 'lodash';
import Machine from './lib/machine';

export default function machine(data) {
  return new Machine(data);
}

export function transition(machine, fromState = null, signal = null) {
  let states = machine.transition(fromState, signal);

  console.log('HERE');

  return states.map((state) => {
    console.log(state);
    return state.relativeId(fromState)
  });
};

