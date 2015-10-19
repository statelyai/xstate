import curry from 'lodash/function/curry';

function signalFilter(filter = () => true, stateReducer) {
  return (state, signal) => {
    if (!state) {
      return stateReducer();
    }
    
    if (!filter(signal)) {
      return state;
    }

    return stateReducer(state, signal);
  }
}

export default curry(signalFilter);