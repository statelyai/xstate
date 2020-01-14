import { StateNode, ActionObject, Guard, InvokeDefinition } from './';
import { mapValues } from './utils';

function getStateNodeId(stateNode: StateNode): string {
  return `#${stateNode.id}`;
}

interface TransitionConfig {
  target: string[];
  source: string;
  actions: Array<ActionObject<any, any>>;
  cond: Guard<any, any> | undefined;
  eventType: string;
}

interface StateNodeConfig {
  type: StateNode['type'];
  initial?: string;
  entry: Array<ActionObject<any, any>>;
  exit: Array<ActionObject<any, any>>;
  on: {
    [key: string]: TransitionConfig[];
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
    on: mapValues(stateNode.on, transition => {
      return transition.map(t => {
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
