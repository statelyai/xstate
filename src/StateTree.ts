import { StateNode } from './StateNode';
import { StateValue, EntryExitStateArrays, EventType } from './types';
import { mapValues, flatten, toStatePaths } from './utils';
import { matchesState } from './matchesState';

export interface StateTreeOptions {
  resolved?: boolean;
}

const defaultStateTreeOptions = {
  resolved: false
};

export class StateTree {
  public parent?: StateTree | undefined;
  public value: Record<string, StateTree>;
  public isResolved: boolean;

  constructor(
    public stateNode: StateNode,
    public _stateValue: StateValue | undefined,
    options: StateTreeOptions = defaultStateTreeOptions
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

    const resolvedOptions = { ...defaultStateTreeOptions, ...options };
    this.isResolved = resolvedOptions.resolved;
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
      this.stateNode.resolve(this.stateValue),
      { resolved: true }
    );
  }

  public get paths(): string[][] {
    return toStatePaths(this.stateValue);
  }

  public get absolute(): StateTree {
    const { _stateValue } = this;
    const absoluteStateValue = {};
    let marker: any = absoluteStateValue;

    this.stateNode.path.forEach((key, i) => {
      if (i === this.stateNode.path.length - 1) {
        marker[key] = _stateValue;
      } else {
        marker[key] = {};
        marker = marker[key];
      }
    });

    return new StateTree(this.stateNode.machine, absoluteStateValue);
  }

  public get nextEvents(): EventType[] {
    const ownEvents = this.stateNode.ownEvents;

    const childEvents = flatten(
      Object.keys(this.value).map(key => {
        const subTree = this.value[key];

        return subTree.nextEvents;
      })
    );

    return [...new Set(childEvents.concat(ownEvents))];
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

        const currentChildKey = Object.keys(this.value)[0];
        const prevChildKey = Object.keys(prevTree.value)[0];

        if (currentChildKey !== prevChildKey) {
          r1.exit = prevTree.value[prevChildKey!].getExitStates();
          r1.entry = this.value[currentChildKey!].getEntryStates();
        } else {
          r1 = this.value[currentChildKey!].getEntryExitStates(
            prevTree.value[prevChildKey!],
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
