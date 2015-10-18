
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
      ? parent._id.concat(this.id)
      : [this.id];

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

        return Object.freeze(transition);
      });

      return state.mapStateRefs();
    });

    return Object.freeze(this);
  }

  relativeId(fromState = null) {
    return _.difference(this._id, fromState._id).join('.');
  }

  transition(fromState = null, signal = null, returnFlag = true) {
    let substateIds = this.getSubstateIds(fromState);
    let initialStates = this.states
      .filter((state) => state.initial);
    let nextStates = [];
    let currentSubstate = substateIds.length
      ? this.getState(substateIds[0])
      : null;

    if (substateIds.length) {
      if (!currentSubstate) {
        return [];
      }

      nextStates = currentSubstate
        .transition(substateIds.slice(1), signal, false);

      if (!nextStates.length) {
        nextStates = this.transitions
          .filter((transition) => transition.isValid(signal))
          .map((transition) => transition.targetState.initialStates())
          .reduce((a, b) => a.concat(b), [])
      }
    } else if (initialStates.length) {
      nextStates = initialStates
        .map((state) => state.transition(null, signal, false))
        .reduce((a, b) => a.concat(b), [])
    } else if (signal) {
      nextStates = this.transitions
        .filter((transition) => transition.isValid(signal))
        .map((transition) => transition.targetState.initialStates())
        .reduce((a, b) => a.concat(b), [])
    } else {
      nextStates = this.initialStates();
    }

    return returnFlag
      ? nextStates.map((state) => state.relativeId(this))
      : nextStates;
  }

  initialStates() {
    let initialStates = this.states
      .filter((state) => state.initial);

    return initialStates.length
      ? initialStates.map((state) => state.initialStates())
        .reduce((a,b) => a.concat(b), [])
      : [this];
  }

  getSubstateIds(fromState) {
    if (!fromState) return [];

    if (fromState instanceof State) {
      return fromState._id;
    }

    fromState = fromState || [];

    return _.isArray(fromState)
      ? fromState
      : _.isString(fromState)
        ? fromState.split(STATE_DELIMITER)
        : false;
  }

  getState(substates) {
    if (substates instanceof State) {
      return substates;
    }

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
