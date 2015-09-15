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

  transition(state, symbol = null) {
    return this.transitionFn(state, symbol);
  }
}

function machine(transitionGraph) {
  
  let states = new Set(Object.keys(transitionGraph)
    .map((state) => [state].concat(Object.keys(transitionGraph[state])))
    .reduce((a, b) => a.concat(b)));

  let symbols = new Set(Object.keys(transitionGraph)
    .map((state) => Object.values(transitionGraph[state]))
    .reduce((a, b) => a.concat(b)));

  
}

function dfaTransition(transitionGraph, state, symbol) {
  let stateGraph = transitionGraph[state];

  return Object.keys(stateGraph)
    .find((toState) => stateGraph[toState] === symbol);
}

console.log(machine({
  red: {
    green: 'timer',
    blink: 'bang'
  },
  yellow: {
    red: 'timer',
    blink: 'bang'
  }
}));