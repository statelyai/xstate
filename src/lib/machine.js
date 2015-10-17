
import State from './state';
import curry from 'lodash/function/curry';


export default class Machine extends State {
  constructor(data) {    
    super(data);

    this.mapStateRefs();
  }
}

