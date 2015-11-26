

function stateReducer(machine) {
  let initialState = machine.transition();

  return (state = initialState, signal) => {
    if (!signal || !machine.isValidSignal(signal)) {
      return state;
    }

    return machine.transition(state, signal);
  }
}

export default stateReducer;