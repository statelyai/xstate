import curry from 'lodash/function/curry';

function actionFilter(filter = () => true, stateReducer) {
  return (state, action) => {
    if (!state) {
      return stateReducer();
    }
    
    if (!filter(action)) {
      return state;
    }


    return stateReducer(state, action);
  }
}

export default curry(actionFilter);