import { StateNode } from './StateNode';
import { StateValue } from './types';
import { mapValues } from './utils';

export class StateTree {
  public stateNode: StateNode;
  public parent?: StateTree | undefined;
  public done: boolean;
  public value: Record<string, StateTree> | undefined;

  constructor(stateNode: StateNode, stateValue: StateValue | undefined) {
    this.stateNode = stateNode;

    if (!stateValue) {
      this.done = stateNode.type === 'final';
      this.value = undefined;
    } else if (typeof stateValue === 'string') {
      const childStateNode = stateNode.getStateNode(stateValue);
      this.done = childStateNode.type === 'final';
      this.value = {
        [stateValue]: new StateTree(
          childStateNode,
          childStateNode.type === 'compound' ||
          childStateNode.type === 'parallel'
            ? childStateNode.initialState.value
            : undefined
        )
      };
    } else {
      const value = mapValues(stateValue, (subValue, key) => {
        return new StateTree(stateNode.getStateNode(key), subValue);
      });

      this.value = value;
      this.done = Object.keys(value).every(key => value[key].done);
    }
  }

  public get stateValue(): StateValue {
    if (this.stateNode.type === 'atomic' || this.stateNode.type === 'final') {
      return {};
    }

    if (this.stateNode.type === 'parallel') {
      return mapValues(this.value!, st => {
        return st.stateValue;
      });
    }

    if (this.stateNode.type === 'compound') {
      const childStateNode = this.value![Object.keys(this.value!)[0]].stateNode;
      if (childStateNode.type === 'atomic') {
        return childStateNode.key;
      }

      return mapValues(this.value!, st => {
        return st.stateValue;
      });
    }

    return {};
  }
}
