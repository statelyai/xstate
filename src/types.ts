import { StateNode } from './index';
import { State } from './State';

export type EventType = string | number;
export type ActionType = string | number;

export interface EventObject {
  type: EventType;
  [key: string]: any;
}
export interface ActionObject {
  type: EventType;
  [key: string]: any;
}

export type Event = EventType | EventObject;
export type StateKey = string | State;

export interface StateValueMap {
  [key: string]: StateValue;
}

export type StateValue = string | StateValueMap;

export type Condition = (extendedState: any) => boolean;

export interface TransitionConfig {
  cond?: (extendedState: any, event: EventObject) => boolean;
  actions?: Action[];
}

export interface TargetTransitionConfig extends TransitionConfig {
  target: string;
}

export type ConditionalTransitionConfig = TargetTransitionConfig[];

export type Transition = string | Record<string, TransitionConfig>;

export type Activity = string | ActionObject;

export interface StateNodeConfig {
  key?: string;
  initial?: string | undefined;
  parallel?: boolean | undefined;
  states?: Record<string, SimpleOrCompoundStateNodeConfig> | undefined;
  on?: Record<string, Transition | undefined>;
  onEntry?: Action | Action[];
  onExit?: Action | Action[];
  activities?: Activity[];
  parent?: StateNode;
  strict?: boolean | undefined;
}
export interface SimpleStateNodeConfig extends StateNodeConfig {
  initial?: undefined;
  parallel?: false | undefined;
  states?: undefined;
}

export interface CompoundStateNodeConfig extends StateNodeConfig {
  initial?: string;
  parallel?: boolean;
  states: Record<string, SimpleOrCompoundStateNodeConfig>;
}

export type SimpleOrCompoundStateNodeConfig =
  | CompoundStateNodeConfig
  | SimpleStateNodeConfig;

export interface MachineConfig extends CompoundStateNodeConfig {
  key?: string;
  strict?: boolean;
}
export interface StandardMachineConfig extends MachineConfig {
  initial: string;
  parallel?: false | undefined;
}

export interface ParallelMachineConfig extends MachineConfig {
  initial?: undefined;
  parallel: true;
}

export type Action = string | ActionObject;
export interface EntryExitEffectMap {
  entry: Action[];
  exit: Action[];
}

export interface StateNode {
  key: string;
  id: string;
  relativeId: string;
  initial: string | undefined;
  parallel: boolean;
  states: Record<string, StateNode>;
  on?: Record<string, Transition>;
  onEntry?: Action | Action[];
  onExit?: Action | Action[];
  parent: StateNode | undefined;
  machine: Machine;
}

export interface ComplexStateNode extends StateNode {
  initial: string;
}

export interface LeafStateNode extends StateNode {
  initial: never;
  parallel: never;
  states: never;
  parent: StateNode;
}

export interface Machine extends StateNode {
  id: string;
  initial: string | undefined;
  parallel: boolean;
  states: Record<string, StateNode>;
  on: never;
  onEntry: never;
  onExit: never;
}

export interface StandardMachine extends Machine {
  initial: string;
  parallel: false;
}

export interface ParallelMachine extends Machine {
  initial: undefined;
  parallel: true;
}
export interface ActionMap {
  onEntry: Action[];
  actions: Action[];
  onExit: Action[];
}

export interface ActivityMap {
  [activityKey: string]: boolean;
}
export type MaybeStateValueActionsTuple = [
  StateValue | undefined,
  ActionMap,
  ActivityMap | undefined
];

export interface TransitionData {
  value: StateValue | undefined;
  actions: ActionMap;
  activities?: ActivityMap;
}
