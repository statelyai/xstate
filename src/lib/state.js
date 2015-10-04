
import Transition from './transition';

export default class State {
  constructor(data) {
    this.id = data.id;

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

  transition(signal = null) {
    
    let activeStates = this.states
      .filter((state) => state.initial)
      .map((state) => state.transition(signal))
      .reduce((a, b) => a.concat(b), []);

    let validTransitions = this.transitions
      .filter((transition) => transition.isValid(signal));

    return activeStates.length
      ? activeStates.map((state) => state.id)
      : validTransitions.length
        ? validTransitions.map((transition) => transition.target)
        : this.id;
  }

  getState(substates) {
    substates = _.isArray(id)
      ? id
      : id.split(STATE_DELIMITER);

    if (!substates.length) {
      return this;
    }

    let substate = this.states
      .find((state) => state.id === substates[0]);

    return substate
      ? substate.getState(substates.slice(1))
      : false;
  }
}