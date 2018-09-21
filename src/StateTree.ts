import { StateNode } from './StateNode';
import { StateValue, EntryExitStateArrays } from './types';
import { mapValues, flatten } from './utils';
import { matchesState } from './matchesState';

export class StateTree {
  public stateNode: StateNode;
  private _stateValue: StateValue | undefined;
  public parent?: StateTree | undefined;
  public done: boolean;
  public value: Record<string, StateTree> | undefined;

  constructor(
    stateNode: StateNode,
    stateValue: StateValue | undefined,
    resolved: boolean = false
  ) {
    this.stateNode = stateNode;
    this._stateValue = stateValue;

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
            ? resolved
              ? childStateNode.initialState.value
              : {}
            : undefined,
          resolved
        )
      };
    } else {
      const value = mapValues(stateValue, (subValue, key) => {
        return new StateTree(stateNode.getStateNode(key), subValue, resolved);
      });

      this.value = value;
      this.done = Object.keys(value).every(key => value[key].done);
    }
  }

  public get resolved(): StateTree {
    return new StateTree(this.stateNode, this._stateValue, true);
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
      if (Object.keys(this.value!).length === 0) {
        return {};
      }
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
  public getEntryExitStates(
    prevTree: StateTree,
    externalNodes?: Set<StateNode<any>>
  ): EntryExitStateArrays<any> {
    if (prevTree.stateNode !== this.stateNode) {
      throw new Error('Cannot compare distinct trees');
    }

    switch (this.stateNode.type) {
      case 'compound':
        let r1: EntryExitStateArrays<any> = {
          exit: [],
          entry: []
        };

        if (Object.keys(this.value!)[0]! !== Object.keys(prevTree.value!)[0]!) {
          r1.exit = prevTree.value![
            Object.keys(prevTree.value!)[0]!
          ].getExitStates();
          r1.entry = this.value![Object.keys(this.value!)[0]!].getEntryStates();
        } else {
          r1 = this.value![Object.keys(this.value!)[0]!].getEntryExitStates(
            prevTree.value![Object.keys(prevTree.value!)[0]!],
            externalNodes
          );
        }

        if (externalNodes && externalNodes.has(this.stateNode)) {
          r1.exit.push(this.stateNode);
          r1.entry.unshift(this.stateNode);
        }
        return r1;

      case 'parallel':
        const all = Object.keys(this.value!).map(key => {
          return this.value![key].getEntryExitStates(
            prevTree.value![key],
            externalNodes
          );
        });

        const result: EntryExitStateArrays<any> = {
          exit: [],
          entry: []
        };

        all.forEach(ees => {
          result.exit = [...result.exit, ...ees.exit];
          result.entry = [...result.entry, ...ees.entry];
        });

        if (externalNodes && externalNodes.has(this.stateNode)) {
          result.exit.push(this.stateNode);
          result.entry.unshift(this.stateNode);
        }

        return result;

      case 'atomic':
      default:
        if (externalNodes && externalNodes.has(this.stateNode)) {
          return {
            exit: [this.stateNode],
            entry: [this.stateNode]
          };
        }
        return {
          exit: [],
          entry: []
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
