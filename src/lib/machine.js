
import State from './state';
import curry from 'lodash/function/curry';


export default class Machine extends State {
  constructor(data) {    
    super(data);

    this.mapStateRefs();
  }

  transition(fromState = null, signal = null) {
    let states = super.transition(fromState, signal);

    return states.map((state) => state.relativeId(this));
  }
}

