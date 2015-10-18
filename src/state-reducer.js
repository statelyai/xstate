function stateReducer(machine) {
  return (state, signal) => {
    return machine.transition(state, signal);
  }
}

export default stateReducer;