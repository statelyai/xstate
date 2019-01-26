import { StateNode } from './StateNode';
import {
  StateValue,
  EntryExitStateArrays,
  EventType,
  StateValueMap,
  EventObject
} from './types';
import { mapValues, flatten, toStatePaths, keys, mapContext } from './utils';
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
    public stateValue: StateValue | undefined,
    options: StateTreeOptions = defaultStateTreeOptions
  ) {
    this.nodes = stateValue
      ? typeof stateValue === 'string'
        ? {
            [stateValue]: new StateTree(
              stateNode.getStateNode(stateValue),
              undefined
            )
          }
        : mapValues(stateValue, (subValue, key) => {
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
        const childTree = this.nodes[keys(this.nodes)[0]];
        return childTree.stateNode.type === 'final';
      case 'parallel':
        return keys(this.nodes).every(key => this.nodes[key].done);
      default:
        return false;
    }
  }

  public getDoneData<TContext>(context: TContext, event: EventObject): any {
    if (!this.done) {
      return undefined;
    }

    if (this.stateNode.type === 'compound') {
      const childTree = this.nodes[keys(this.nodes)[0]];

      if (!childTree.stateNode.data) {
        return undefined;
      }

      return mapContext(childTree.stateNode.data, context, event);
    }

    return undefined;
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

  public getDoneEvents(entryStateNodes?: Set<StateNode>): EventObject[] {
    // If no state nodes are being entered, no done events will be fired
    if (!entryStateNodes || !entryStateNodes.size) {
      return [];
    }

    if (
      entryStateNodes.has(this.stateNode) &&
      this.stateNode.type === 'final'
    ) {
      return [done(this.stateNode.id, this.stateNode.data)];
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
        return childDoneEvents.concat(done(this.stateNode.id));
      } else {
        return childDoneEvents;
      }
    }

    if (!this.done || !childDoneEvents.length) {
      return childDoneEvents;
    }

    // TODO: handle merging strategy
    // For compound state nodes with final child state, there should be only
    // one done.state event (potentially with data).
    const doneData =
      childDoneEvents.length === 1 ? childDoneEvents[0].data : undefined;

    return childDoneEvents.concat(done(this.stateNode.id, doneData));
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
    const { stateValue: _stateValue } = this;
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
        let compoundResult: EntryExitStateArrays<any> = {
          exit: [],
          entry: []
        };

        const currentChildKey = keys(this.nodes)[0];
        const prevChildKey = keys(prevTree.nodes)[0];

        if (currentChildKey !== prevChildKey) {
          compoundResult.exit = prevTree.nodes[prevChildKey!].getExitStates();
          compoundResult.entry = this.nodes[currentChildKey!].getEntryStates();
        } else {
          compoundResult = this.nodes[currentChildKey!].getEntryExitStates(
            prevTree.nodes[prevChildKey!],
            externalNodes
          );
        }

        if (externalNodes && externalNodes.has(this.stateNode)) {
          compoundResult.exit.push(this.stateNode);
          compoundResult.entry.unshift(this.stateNode);
        }
        return compoundResult;

      case 'parallel':
        const all = keys(this.nodes).map(key => {
          return this.nodes[key].getEntryExitStates(
            prevTree.nodes[key],
            externalNodes
          );
        });

        const parallelResult: EntryExitStateArrays<any> = {
          exit: [],
          entry: []
        };

        all.forEach(ees => {
          parallelResult.exit = [...parallelResult.exit, ...ees.exit];
          parallelResult.entry = [...parallelResult.entry, ...ees.entry];
        });

        if (externalNodes && externalNodes.has(this.stateNode)) {
          parallelResult.exit.push(this.stateNode);
          parallelResult.entry.unshift(this.stateNode);
        }

        return parallelResult;

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
