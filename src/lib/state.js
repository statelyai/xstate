
import Transition from './transition';
import _ from 'lodash';

const STATE_DELIMITER = '.';


Array.prototype.log = function(msg) {
  console.log(msg, this);

  return this;
}

export default class State {
  constructor(data) {
    this.id = data.id || 'root';

    this.states = data.states
      ? data.states
        .map((state) => new State(state))
      : [];

    this.transitions = data.transitions
      ? data.transitions
        .map((transition) => new Transition(transition))
      : [];

    this.initial = !!data.initial;

    this.final = !!data.final;
  }

  transition(fromState = null, signal = null) {
    let nextStates = [];

    fromState = this.getState(fromState);

    console.log('fromState = ', fromState.id);

    if (fromState) {    
      nextStates = fromState.transition(signal);
    } else {    
      nextStates = this.states
        .filter((state) => state.initial)
        .map((state) => state.transition(signal))
        .reduce(_.flatten, []);
    }

    if (!nextStates) {
      nextStates = this.transitions
        .filter((transition) => transition.isValid(signal))
        .map((transition) => transition.target);
    }

    return nextStates.length
      ? nextStates.map((id) => `${this.id}.${id}`)
      : false;
  }

  getState(substates) {
    substates = _.isArray(substates)
      ? substates
      : substates.split(STATE_DELIMITER);

    if (!substates || !substates.length) {
      return this;
    }

    let substate = this.states
      .find((state) => state.id === substates[0]);

    return substate
      ? substate.getState(substates.slice(1))
      : false;
  }
}
