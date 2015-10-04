import _ from 'lodash';

import Signal from './signal';

export default class Transition {
  constructor(data) {
    this.event = data.event;

    this.target = data.target;

    this.cond = data.cond || () => true;
  }

  isValid(signal) {
    signal = new Signal(signal);

    return signal.event === this.event
      && !!this.cond(signal.payload);
  }
}