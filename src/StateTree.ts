import { StateNode } from './StateNode';
import { StateValue } from './types';
import { mapValues } from './utils';

export class StateTree {
  public stateNode: StateNode;
  public parent?: StateTree | undefined;
  public done: boolean;
  public value: Record<string, StateTree> | undefined;

  constructor(stateNode: StateNode, stateValue: StateValue | undefined) {
    if (!stateValue) {
      this.stateNode = stateNode;
      this.done = stateNode.type === 'final';
      this.value = undefined;
    } else if (typeof stateValue === 'string') {
      const childStateNode = stateNode.getStateNode(stateValue);
      this.stateNode = stateNode;
      this.done = childStateNode.type === 'final';
      this.value = {
        [stateValue]: new StateTree(
          stateNode.getStateNode(stateValue),
          undefined
        )
      };
    } else {
      const value = mapValues(stateValue, (subValue, key) => {
        return new StateTree(stateNode.getStateNode(key), subValue);
      });

      this.stateNode = stateNode;
      this.value = value;
      this.done = Object.keys(value).every(key => value[key].done);
    }
  }
}
