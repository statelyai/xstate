import {
  StateNode,
  GuardObject,
  InvokeDefinition,
  BaseActionObject
} from './index.ts';
import { mapValues, isFunction } from './utils.ts';

interface JSONFunction {
  $function: string;
}

// tslint:disable-next-line:ban-types
export function stringifyFunction(fn: Function): JSONFunction {
  return {
    $function: fn.toString()
  };
}

function getStateNodeId(stateNode: StateNode): string {
  return `#${stateNode.id}`;
}

interface TransitionConfig {
  target: string[];
  source: string;
  actions: Array<BaseActionObject>;
  guard: GuardObject<any, any> | undefined;
  eventType: string;
}

interface StateNodeConfig {
  type: StateNode['type'];
  id: string;
  key: string;
  initial?: string;
  entry: Array<BaseActionObject>;
  exit: Array<BaseActionObject>;
  on: {
    [key: string]: TransitionConfig[];
  };
  invoke: Array<InvokeDefinition<any, any>>;
  states: Record<string, StateNodeConfig>;
}

// derive config from machine
export function machineToJSON(stateNode: StateNode): StateNodeConfig {
  const config = {
    type: stateNode.type,
    initial:
      stateNode.initial === undefined ? undefined : String(stateNode.initial),
    id: stateNode.id,
    key: stateNode.key,
    entry: stateNode.entry,
    exit: stateNode.exit,
    on: mapValues(stateNode.on, (transition) => {
      return transition.map((t) => {
        return {
          target: t.target ? t.target.map(getStateNodeId) : [],
          source: getStateNodeId(t.source),
          actions: t.actions,
          guard: t.guard,
          eventType: t.eventType
        };
      });
    }),
    invoke: stateNode.invoke,
    states: {} as Record<string, StateNodeConfig>
  };

  Object.values(stateNode.states).forEach((sn) => {
    config.states[sn.key] = machineToJSON(sn);
  });

  return config;
}

export function stringify(machine: StateNode): string {
  return JSON.stringify(
    machineToJSON(machine),
    (_, value) => {
      if (isFunction(value)) {
        return { $function: value.toString() };
      }
      return value;
    },
    2
  );
}

export function parse(machineString: string): StateNodeConfig {
  const config = JSON.parse(machineString, (_, value) => {
    if (typeof value === 'object' && '$function' in value) {
      return new Function(value.value);
    }

    return value;
  });

  return config;
}
