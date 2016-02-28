import Action from './action';

function alwaysTrue() {
  return true;
}

export default class Transition {
  constructor(data, fromState) {
    this.event = data.event;

    this.target = data.target;

    this.cond = data.cond || alwaysTrue;
  }

  isValid(action) {
    action = new Action(action);

    return action.type === this.event
      && !!this.cond(action);
  }
}
