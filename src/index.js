if (!global._babelPolyfill) {
  require('babel-core/polyfill');
}

import _ from 'lodash';

class Machine {
  constructor(signals, states, initialState, transitionFn, finalStates = []) {
    this.signals = signals;
    this.states = states;
    this.initialState = initialState;
    this.transitionFn = transitionFn;
    this.finalStates = finalStates;
  }

  transition(stateName, symbol = null) {
    let state = this.states.find((state) => state.name === stateName);

    return this.transitionFn(state, symbol);
  }
}

class State {
  constructor(name, transitionMap = {}) {
    this.name = name;

    this.transitions = Object.keys(transitionMap)
      .map((toState) => new Transition(name, toState, transitionMap[toState]));
  }
}

class Transition {
  constructor(fromState, toState, signals) {
    this.from = fromState;
    this.to = toState;
    this.signals = signals;
  }
}

/**
 * Simple machine representation for estado.
 *
 * {
 *   (String) state : {
 *     (String) toState : (String|String[]) symbol(s)
 *   }
 * }
 * 
 * @param  {Object} transitionGraph Object representing transition graph
 *                                  (as described above)
 * @param  {Array}  finalStates     Array of final states (defaults to [])
 * @return {Machine}                Returns an estado Machine instance.
 */
export function machine(transitionGraph, finalStates = []) {

  let states = getStates(transitionGraph);

  let signals = getSignals(transitionGraph);

  let initialState = states[0];

  return new Machine(signals, states, initialState, dfaTransition, finalStates);
}

function getStates(transitionGraph) {
  return Object.keys(transitionGraph)
    .map((stateName) => new State(stateName, transitionGraph[stateName] || {}));
}

function getSignals(transitionGraph) {
  let signals = [];

  if (_.isString(transitionGraph) || _.isArray(transitionGraph)) {
    signals = Array.prototype.concat([], transitionGraph);
  } else if (_.isObject(transitionGraph)) {
    signals = _.values(transitionGraph)
      .map((stateValue) => getSignals(stateValue))
      .reduce((a, b) => a.concat(b));
  }

  return _.unique(signals);
}

function dfaTransition(state, symbol) {
  let transition = state.transitions
    .find((transition) => _.contains(transition.signals, symbol));

  if (transition) {
    return transition.to;
  }

  console.error(`State '${state.name}' does not have a valid transition for symbol '${symbol}'`);
}


