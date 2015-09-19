import 'babel-core/polyfill';
import _ from 'lodash';

class Machine {
  constructor(symbols, states, initialState, transitionFn, finalStates = []) {
    this.symbols = symbols;
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
  constructor(fromState, toState, symbols) {
    this.from = fromState;
    this.to = toState;
    this.symbols = symbols;
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
export default function machine(transitionGraph, finalStates = []) {

  let states = Object.keys(transitionGraph)
    .filter((state) => _.isObject(transitionGraph[state]))
    .map((state) => new State(state, transitionGraph[state]));

  let symbols = _.unique(Object.keys(transitionGraph)
    .filter((state) => _.isObject(transitionGraph[state]))
    .map((state) => _.flatten(Object.values(transitionGraph[state])))
    .reduce((a, b) => a.concat(b)));

  let initialState = states[0];

  return new Machine(symbols, states, initialState, dfaTransition, finalStates);
}

function dfaTransition(state, symbol) {
  let transition = state.transitions
    .find((transition) => _.contains(transition.symbols, symbol));

  if (transition) {
    return transition.to;
  }

  console.error(`State '${state.name}' does not have a valid transition for symbol '${symbol}'`);
}

console.log(machine({
  green: {
    yellow: 'timer'
  },
  yellow: {
    red: ['timer', 'else']
  },
  red: {
    green: ['timer', 'a', 'b']
  },
  black: null
}).transition('green', 'timer'));


