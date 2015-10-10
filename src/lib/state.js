
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
    let substateIds = this.getSubstateIds(fromState);
    let initialStates = this.states
      .filter((state) => state.initial);
    let nextStates = [];

    if (substateIds.length) {
      nextStates = this.getState(substateIds[0])
        .transition(substateIds.slice(1), signal);

      if (!nextStates.length) {
        nextStates = this.transitions
          .filter((transition) => transition.isValid(signal))
          .map((transition) => transition.target);
      }
    } else if (initialStates.length) {
      nextStates = initialStates
        .map((state) => state.transition(null, signal))
        .reduce(_.flatten)
        .map((id) => `${this.id}.${id}`);
    } else if (signal) {
      nextStates = this.transitions
        .filter((transition) => transition.isValid(signal))
        .map((transition) => transition.target);
    } else {
      return [this.id];
    }

    return nextStates;
  }

  getSubstateIds(fromState) {
    fromState = fromState || [];

    return _.isArray(fromState)
      ? fromState
      : _.isString(fromState)
        ? fromState.split(STATE_DELIMITER)
        : false;
  }

  getState(substates) {
    substates = this.getSubstateIds(substates);

    if (!substates.length) {
      return this;
    }

    let substate = this.states
      .find((state) => state.id === substates[0]);

    return substate
      ? substates.length > 1
        ? substate.getState(substates.slice(1))
        : substate
      : false;
  }
}
