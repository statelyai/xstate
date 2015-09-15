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
    let state = this.states.find((_state) => _state.name === stateName);

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
  constructor(fromState, toState, symbol) {
    this.from = fromState;
    this.to = toState;
    this.symbol = symbol;
  }
}

function machine(transitionGraph) {

  let states = Object.keys(transitionGraph)
    .map((state) => new State(state, transitionGraph[state]));

  let symbols = new Set(Object.keys(transitionGraph)
    .map((state) => Object.values(transitionGraph[state]))
    .reduce((a, b) => a.concat(b)));

  let initialState = states[0];

  return new Machine(symbols, states, initialState, dfaTransition);
}

function dfaTransition(state, symbol) {
  return state.transitions
    .find((transition) => transition.symbol === symbol)
    .to;
}

console.log(machine({
  green: {
    yellow: 'timer'
  },
  yellow: {
    red: 'timer'
  },
  red: {
    green: 'timer'
  }
}).transition('red', 'timer'));