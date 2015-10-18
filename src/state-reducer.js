import curry from 'lodash/function/curry';

function stateReducer(machine, signalMapper) {
  return (state, action) => {
    let signal = signalMapper(action);

    if (!signal) {
      return state;
    }

    return machine.transition(state, signal);
  }
}

export default curry(stateReducer);