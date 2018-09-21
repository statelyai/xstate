import { StateNode } from './StateNode';
import { StateValue, EntryExitStateArrays } from './types';
import { mapValues, flatten, toStatePaths } from './utils';
import { matchesState } from './matchesState';

export class StateTree {
  public parent?: StateTree | undefined;
  public value: Record<string, StateTree>;

  constructor(
    public stateNode: StateNode,
    public _stateValue: StateValue | undefined
  ) {
    this.value = _stateValue
      ? typeof _stateValue === 'string'
        ? {
            [_stateValue]: new StateTree(
              stateNode.getStateNode(_stateValue),
              undefined
            )
          }
        : mapValues(_stateValue, (subValue, key) => {
            return new StateTree(stateNode.getStateNode(key), subValue);
          })
      : {};
  }

  public get done(): boolean {
    switch (this.stateNode.type) {
      case 'final':
        return true;
      case 'compound':
        return this.value[Object.keys(this.value)[0]].done;
      case 'parallel':
        return Object.keys(this.value).some(key => this.value[key].done);
      default:
        return false;
    }
  }

  public get resolved(): StateTree {
    return new StateTree(
      this.stateNode,
      this.stateNode.resolve(this.stateValue)
    );
  }

  public get paths(): string[][] {
    return toStatePaths(this.stateValue);
  }

  public clone(): StateTree {
    return new StateTree(this.stateNode, this.stateValue);
  }

  public combine(tree: StateTree): StateTree {
    if (tree.stateNode !== this.stateNode) {
      throw new Error('Cannot combine distinct trees');
    }

    if (this.stateNode.type === 'compound') {
      // Only combine if no child state is defined
      let newValue: Record<string, StateTree>;
      if (!Object.keys(this.value).length || !Object.keys(tree.value).length) {
        newValue = Object.assign({}, this.value, tree.value);

        const newTree = this.clone();
        newTree.value = newValue;

        return newTree;
      } else {
        const childKey = Object.keys(this.value)[0];

        newValue = {
          [childKey]: this.value[childKey].combine(tree.value[childKey])
        };

        const newTree = this.clone();
        newTree.value = newValue;
        return newTree;
      }
    }

    if (this.stateNode.type === 'parallel') {
      const keys = new Set([
        ...Object.keys(this.value),
        ...Object.keys(tree.value)
      ]);

      const newValue: Record<string, StateTree> = {};

      keys.forEach(key => {
        if (!this.value[key] || !tree.value[key]) {
          newValue[key] = this.value[key] || tree.value[key];
        } else {
          newValue[key] = this.value[key]!.combine(tree.value[key]!);
        }
      });

      const newTree = this.clone();
      newTree.value = newValue;
      return newTree;
    }

    // nothing to do
    return this;
  }

  public get stateValue(): StateValue {
    if (this.stateNode.type === 'atomic' || this.stateNode.type === 'final') {
      return {};
    }

    if (this.stateNode.type === 'parallel') {
      return mapValues(this.value, st => {
        return st.stateValue;
      });
    }

    if (this.stateNode.type === 'compound') {
      if (Object.keys(this.value).length === 0) {
        return {};
      }
      const childStateNode = this.value[Object.keys(this.value)[0]].stateNode;
      if (childStateNode.type === 'atomic' || childStateNode.type === 'final') {
        return childStateNode.key;
      }

      return mapValues(this.value, st => {
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

        if (Object.keys(this.value)[0]! !== Object.keys(prevTree.value)[0]!) {
          r1.exit = prevTree.value[
            Object.keys(prevTree.value)[0]!
          ].getExitStates();
          r1.entry = this.value[Object.keys(this.value)[0]!].getEntryStates();
        } else {
          r1 = this.value[Object.keys(this.value)[0]!].getEntryExitStates(
            prevTree.value[Object.keys(prevTree.value)[0]!],
            externalNodes
          );
        }

        if (externalNodes && externalNodes.has(this.stateNode)) {
          r1.exit.push(this.stateNode);
          r1.entry.unshift(this.stateNode);
        }
        return r1;

      case 'parallel':
        const all = Object.keys(this.value).map(key => {
          return this.value[key].getEntryExitStates(
            prevTree.value[key],
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
          return this.value[key].getEntryStates();
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
        return this.value[key].getExitStates();
      })
    ).concat(this.stateNode);
  }
}
