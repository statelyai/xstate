
import State from './state';

const STATE_DELIMITER = '.';

export default class Machine {
  constructor(data) {
    this.states = data.states
      ? data.states
        .map((state) => new State(state))
      : [];
  }

  transition(fromState = null, signal = null) {
    
    if (!(fromState || signal)) {
      return this.states
        .filter((state) => state.initial)
        .map((state) => state.transition());
    }

    return this.states
      .filter((state) => state.id === fromState)
      .map((state) => state.transition(signal))
      .reduce((a, b) => a.concat(b), []);
  }

  getState(id) {
    let substates = _.isArray(id)
      ? id
      : id.split(STATE_DELIMITER);

    let substate = this.states
      .find((state) => state.id === substates[0]);

    return substate
      ? substate.getState(substates.slice(1))
      : false;
  }
}