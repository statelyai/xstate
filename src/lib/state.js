
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
    let initialStates = this.states
      .filter((state) => state.initial);
    let substateIds = this.getSubstateIds(fromState);
    let substate = this.getState(substateIds[0]);
    let nextStates = [];

    if (substateIds.length) {
      nextStates = this.getState(substateIds[0])
        .transition(substateIds.slice(1), signal);

      if (nextStates.length) {
        return nextStates;
      }
    }

    if (!initialStates.length && !substateIds.length) {
      nextStates = this.transitions
        .filter((transition) => transition.isValid(signal))
        .map((transition) => transition.target);

      return nextStates.length
        ? nextStates
        : [this.id];
    }

    if (initialStates.length && !substateIds.length) {
      return initialStates
        .map((state) => state.transition(null, signal))
        .reduce(_.flatten)
        .map((id) => `${this.id}.${id}`)
    }

    if (!initialStates.length) {
      return [this.id];
    }

    return substate.transition(substateIds.slice(1), signal);
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
