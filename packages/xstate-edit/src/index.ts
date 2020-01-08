import { StateNode, ActionObject, Guard, InvokeDefinition } from 'xstate';
import { mapValues } from 'xstate/lib/utils';
import { getBacklinkMap } from './utils';

function getStateNodeId(stateNode: StateNode): string {
  return `#${stateNode.id}`;
}

interface StateNodeConfig {
  type: StateNode['type'];
  initial?: string;
  entry: Array<ActionObject<any, any>>;
  exit: Array<ActionObject<any, any>>;
  on: {
    [key: string]: Array<{
      target: string[];
      source: string;
      actions: Array<ActionObject<any, any>>;
      cond: Guard<any, any> | undefined;
      eventType: string;
    }>;
  };
  invoke: Array<InvokeDefinition<any, any>>;
  states: Record<string, StateNodeConfig>;
}

// derive config from machine
export function getConfig(stateNode: StateNode): StateNodeConfig {
  const config = {
    type: stateNode.type,
    initial:
      stateNode.initial === undefined ? undefined : String(stateNode.initial),
    id: stateNode.id,
    entry: stateNode.onEntry,
    exit: stateNode.onExit,
    on: mapValues(stateNode.on, tran => {
      return tran.map(t => {
        return {
          target: t.target ? t.target.map(getStateNodeId) : [],
          source: getStateNodeId(t.source),
          actions: t.actions,
          cond: t.cond,
          eventType: t.eventType
        };
      });
    }),
    invoke: stateNode.invoke,
    states: {}
  };

  Object.values(stateNode.states).forEach(sn => {
    config.states[sn.key] = getConfig(sn);
  });

  return config;
}

export function setId(
  machine: StateNode,
  id: string,
  newId: string
): StateNodeConfig {
  const stateNode = machine.getStateNodeById(id);

  stateNode.id = newId;

  return getConfig(machine);
}

export function setKey(
  machine: StateNode,
  id: string,
  newKey: string
): StateNodeConfig {
  const stateNode = machine.getStateNodeById(id);

  stateNode.key = newKey;

  return getConfig(machine);
}

export function deleteStateNode(
  machine: StateNode,
  id: string
): StateNodeConfig {
  const stateNode = machine.getStateNodeById(id);

  const backlinkMap = getBacklinkMap(machine);

  const backlinks = backlinkMap.get(stateNode) || new Set();

  backlinks.forEach(sourceNode => {
    Object.keys(sourceNode.on).forEach(key => {
      const transitions = sourceNode.on[key];
      const toDelete = [] as number[];

      transitions.forEach((transition, i) => {
        if (transition.target && transition.target.includes(stateNode)) {
          toDelete.push(i);
        }
      });

      const updatedTransitions = transitions.filter(
        (_, i) => !toDelete.includes(i)
      );

      sourceNode.on[key] = updatedTransitions;
    });
  });

  delete stateNode.parent!.states[stateNode.key];

  return getConfig(machine);
}

export function deleteTransition(
  machine: StateNode,
  id: string,
  event: string,
  index: number
): StateNodeConfig {
  const stateNode = machine.getStateNodeById(id);

  const transitions = stateNode.on[event];

  transitions.splice(index, 1);

  return getConfig(machine);
}
