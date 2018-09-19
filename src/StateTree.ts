import { StateNode } from './StateNode';
import { StateValue, EntryExitStates } from './types';
import { mapValues, flatten } from './utils';
import { matchesState } from './matchesState';

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
  public matches(parentValue: StateValue): boolean {
    return matchesState(parentValue, this.stateValue);
  }
  public getEntryExitStates(prevTree: StateTree): EntryExitStates<any> {
    if (prevTree.stateNode !== this.stateNode) {
      throw new Error('Cannot compare distinct trees');
    }

    switch (this.stateNode.type) {
      case 'compound':
        if (Object.keys(this.value!)[0]! !== Object.keys(prevTree.value!)[0]!) {
          return {
            exit: new Set(
              prevTree.value![Object.keys(prevTree.value!)[0]!].getExitStates()
            ),
            entry: new Set(
              this.value![Object.keys(this.value!)[0]!].getEntryStates()
            )
          };
        }

        return this.value![Object.keys(this.value!)[0]!].getEntryExitStates(
          prevTree.value![Object.keys(prevTree.value!)[0]!]
        );

      case 'parallel':
        const all = Object.keys(this.value!).map(key => {
          return this.value![key].getEntryExitStates(prevTree.value![key]);
        });

        const result = {
          exit: new Set(),
          entry: new Set()
        };

        all.forEach(ees => {
          result.exit = new Set([...result.exit, ...ees.exit]);
          result.entry = new Set([...result.entry, ...ees.entry]);
        });

        return result;

      case 'atomic':
      default:
        return {
          exit: new Set(),
          entry: new Set()
        };
    }
  }

  public getEntryStates(): StateNode[] {
    if (!this.value) {
      return [this.stateNode];
    }

    return [this.stateNode].concat(
      flatten(
        Object.keys(this.value).map(key => {
          return this.value![key].getEntryStates();
        })
      )
    );
  }

  public getExitStates(): StateNode[] {
    if (!this.value) {
      return [this.stateNode];
    }

    return flatten(
      Object.keys(this.value).map(key => {
        return this.value![key].getExitStates();
      })
    ).concat(this.stateNode);
  }
}
