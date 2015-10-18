import Signal from './signal';

export default class Transition {
  constructor(data, fromState) {
    this.event = data.event;

    this.target = data.target;

    this.cond = data.cond || () => true;
  }

  isValid(signal) {
    signal = new Signal(signal);

    return signal.type === this.event
      && !!this.cond(signal);
  }
}