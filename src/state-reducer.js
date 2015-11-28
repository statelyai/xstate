

function stateReducer(machine) {
  let initialState = machine.transition();

  return (state = initialState, action) => {
    if (!action || !machine.isValidAction(action)) {
      return state;
    }

    return machine.transition(state, action);
  }
}

export default stateReducer;