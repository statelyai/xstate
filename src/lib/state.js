
import Transition from './transition';
import _ from 'lodash';

const STATE_DELIMITER = '.';


Array.prototype.log = function(msg) {
  console.log(msg, this);

  return this;
}

export default class State {
  constructor(data, parent = null) {
    this.id = data.id || 'root';

    this._id = parent
      ? `${parent._id}.${this.id}`
      : this.id;

    this.states = data.states
      ? data.states
        .map((state) => new State(state, this))
      : [];

    this.transitions = data.transitions
      ? data.transitions
        .map((transition) => new Transition(transition))
      : [];

    this.initial = !!data.initial;

    this.final = !!data.final;
  }

  mapStateRefs() {
    this.states = this.states.map((state) => {
      state.transitions = state.transitions.map((transition) => {
        transition.targetState = this.getState(transition.target);

        return transition;
      });

      return state.mapStateRefs();
    });

    return this;
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
      } else if (!substateIds.slice(1)) {

        nextStates = nextStates
          .map((id) => this.getState(id))
          .filter(_.identity)
          .map((state) => state.getInitialStates())
          .reduce((a, b) => a.concat(b), []);
      }
    } else if (initialStates.length) {
      nextStates = initialStates
        .map((state) => state.transition(null, signal))
        .reduce((a, b) => a.concat(b))
        .map((id) => `${this.id}.${id}`);
    } else if (signal) {
      nextStates = this.transitions
        .filter((transition) => transition.isValid(signal))
        .map((transition) => transition.targetState.getInitialStates())
        .reduce((a, b) => a.concat(b), [])
    } else {
      nextStates = initialStates.concat(this.id);
    }

    return nextStates;
  }

  getInitialStates() {
    let initialStates = this.states
      .filter((state) => state.initial);

    return initialStates.length
      ? initialStates.map((state) => state.getInitialStates())
        .reduce((a,b) => a.concat(b), [])
        .map((id) => this.id + '.' + id)
      : [this.id];
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
