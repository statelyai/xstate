import { StateNode } from './StateNode';
import {
  StateValue,
  EntryExitStateArrays,
  EventType,
  StateValueMap
} from './types';
import { mapValues, flatten, toStatePaths, keys } from './utils';
import { matchesState } from './utils';
import { done } from './actions';

export interface StateTreeOptions {
  resolved?: boolean;
}

const defaultStateTreeOptions = {
  resolved: false
};

export class StateTree {
  public parent?: StateTree | undefined;
  public nodes: Record<string, StateTree>;
  public isResolved: boolean;

  constructor(
    public stateNode: StateNode,
    public _stateValue: StateValue | undefined,
    options: StateTreeOptions = defaultStateTreeOptions
  ) {
    this.nodes = _stateValue
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
        const childNode = this.nodes[keys(this.nodes)[0]];
        return childNode.stateNode.type === 'final';
      case 'parallel':
        return keys(this.nodes).some(key => this.nodes[key].done);
      default:
        return false;
    }
  }

  public get atomicNodes(): StateNode[] {
    if (this.stateNode.type === 'atomic' || this.stateNode.type === 'final') {
      return [this.stateNode];
    }

    return flatten(
      keys(this.value as StateValueMap).map(key => {
        return this.value[key].atomicNodes;
      })
    );
  }

  public getDoneEvents(entryStateNodes?: Set<StateNode>): EventType[] {
    // If no state nodes are being entered, no done events will be fired
    if (!entryStateNodes || !entryStateNodes.size) {
      return [];
    }

    if (
      entryStateNodes.has(this.stateNode) &&
      this.stateNode.type === 'final'
    ) {
      return [done(this.stateNode.id)];
    }

    const childDoneEvents = flatten(
      keys(this.nodes).map(key => {
        return this.nodes[key].getDoneEvents(entryStateNodes);
      })
    );

    if (this.stateNode.type === 'parallel') {
      const allChildrenDone = keys(this.nodes).every(
        key => this.nodes[key].done
      );

      if (childDoneEvents && allChildrenDone) {
        return [done(this.stateNode.id)].concat(childDoneEvents);
      } else {
        return childDoneEvents;
      }
    }

    if (!this.done || !childDoneEvents.length) {
      return childDoneEvents;
    }

    return [done(this.stateNode.id)].concat(childDoneEvents);
  }

  public get resolved(): StateTree {
    return new StateTree(this.stateNode, this.stateNode.resolve(this.value), {
      resolved: true
    });
  }

  public get paths(): string[][] {
    return toStatePaths(this.value);
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
      keys(this.nodes).map(key => {
        const subTree = this.nodes[key];

        return subTree.nextEvents;
      })
    );

    return [...new Set(childEvents.concat(ownEvents))];
  }

  public clone(): StateTree {
    return new StateTree(this.stateNode, this.value);
  }

  public combine(tree: StateTree): StateTree {
    if (tree.stateNode !== this.stateNode) {
      throw new Error('Cannot combine distinct trees');
    }

    if (this.stateNode.type === 'compound') {
      // Only combine if no child state is defined
      let newValue: Record<string, StateTree>;
      if (!keys(this.nodes).length || !keys(tree.nodes).length) {
        newValue = Object.assign({}, this.nodes, tree.nodes);

        const newTree = this.clone();
        newTree.nodes = newValue;

        return newTree;
      } else {
        const childKey = keys(this.nodes)[0];

        newValue = {
          [childKey]: this.nodes[childKey].combine(tree.nodes[childKey])
        };

        const newTree = this.clone();
        newTree.nodes = newValue;
        return newTree;
      }
    }

    if (this.stateNode.type === 'parallel') {
      const valueKeys = new Set([...keys(this.nodes), ...keys(tree.nodes)]);

      const newValue: Record<string, StateTree> = {};

      valueKeys.forEach(key => {
        if (!this.nodes[key] || !tree.nodes[key]) {
          newValue[key] = this.nodes[key] || tree.nodes[key];
        } else {
          newValue[key] = this.nodes[key]!.combine(tree.nodes[key]!);
        }
      });

      const newTree = this.clone();
      newTree.nodes = newValue;
      return newTree;
    }

    // nothing to do
    return this;
  }

  public get value(): StateValue {
    if (this.stateNode.type === 'atomic' || this.stateNode.type === 'final') {
      return {};
    }

    if (this.stateNode.type === 'parallel') {
      return mapValues(this.nodes, st => {
        return st.value;
      });
    }

    if (this.stateNode.type === 'compound') {
      if (keys(this.nodes).length === 0) {
        return {};
      }
      const childStateNode = this.nodes[keys(this.nodes)[0]].stateNode;
      if (childStateNode.type === 'atomic' || childStateNode.type === 'final') {
        return childStateNode.key;
      }

      return mapValues(this.nodes, st => {
        return st.value;
      });
    }

    return {};
  }
  public matches(parentValue: StateValue): boolean {
    return matchesState(parentValue, this.value);
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

        const currentChildKey = keys(this.nodes)[0];
        const prevChildKey = keys(prevTree.nodes)[0];

        if (currentChildKey !== prevChildKey) {
          r1.exit = prevTree.nodes[prevChildKey!].getExitStates();
          r1.entry = this.nodes[currentChildKey!].getEntryStates();
        } else {
          r1 = this.nodes[currentChildKey!].getEntryExitStates(
            prevTree.nodes[prevChildKey!],
            externalNodes
          );
        }

        if (externalNodes && externalNodes.has(this.stateNode)) {
          r1.exit.push(this.stateNode);
          r1.entry.unshift(this.stateNode);
        }
        return r1;

      case 'parallel':
        const all = keys(this.nodes).map(key => {
          return this.nodes[key].getEntryExitStates(
            prevTree.nodes[key],
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
    if (!this.nodes) {
      return [this.stateNode];
    }

    return [this.stateNode].concat(
      flatten(
        keys(this.nodes).map(key => {
          return this.nodes[key].getEntryStates();
        })
      )
    );
  }

  public getExitStates(): StateNode[] {
    if (!this.nodes) {
      return [this.stateNode];
    }

    return flatten(
      keys(this.nodes).map(key => {
        return this.nodes[key].getExitStates();
      })
    ).concat(this.stateNode);
  }
}
