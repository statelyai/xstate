
import State from './state';
import curry from 'lodash/function/curry';


export default class Machine extends State {
  constructor(data, options) {    
    super(data);

    this.options = options;

    this.mapStateRefs();
  }

  transition(fromState = null, signal = null) {
    let states = super.transition(fromState, signal);

    // console.log(states, states[0]);

    if (this.options.deterministic) {
      return states.length
        ? states[0]
        : false;
    }

    return states;
  }
}

