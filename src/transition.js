import Action from './action';

export default class Transition {
  constructor(data, fromState) {
    this.event = data.event;

    this.target = data.target;

    this.cond = data.cond || () => true;
  }

  isValid(action) {
    action = new Action(action);

    return action.type === this.event
      && !!this.cond(action);
  }
}