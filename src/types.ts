import { StateNode } from './StateNode';
import { State } from './State';
import { AssignAction } from './actions';

export type EventType = string | number;
export type ActionType = string | number;
export type MetaObject = Record<string, any>;

export interface EventObject {
  type: EventType;
  id?: string | number;
  [key: string]: any;
}
export interface ActionObject extends Record<string, any> {
  type: EventType;
}

export type Event = EventType | EventObject;
export type InternalEvent = EventType | EventObject;
export type ActionFunction = ((
  extendedState: any,
  event?: EventObject
) => any | void);
export type Action = ActionType | ActionObject | ActionFunction;
export type StateKey = string | State;

export interface StateValueMap {
  [key: string]: StateValue;
}

export type StateValue = string | StateValueMap;

export interface HistoryValue {
  states: Record<string, HistoryValue | undefined>;
  current: StateValue | undefined;
}

export type ConditionPredicate = (
  extendedState: any,
  event: EventObject,
  microstepState: StateValue
) => boolean;

export type Condition = string | ConditionPredicate;

export interface TransitionConfig<TExtState> {
  cond?: Condition;
  actions?: Array<Action | AssignAction<TExtState>>;
  in?: StateValue;
  internal?: boolean;
}

export interface TargetTransitionConfig<TExtState>
  extends TransitionConfig<TExtState> {
  target: string | string[];
}

export type ConditionalTransitionConfig<TExtState> = Array<
  TargetTransitionConfig<TExtState>
>;

export type Transition<TExtState> =
  | string
  | Record<string, TransitionConfig<TExtState>>
  | ConditionalTransitionConfig<TExtState>;

export type Activity = string | ActionObject;

export interface StateNodeConfig<TExtState> {
  key?: string;
  initial?: string | undefined;
  parallel?: boolean | undefined;
  /**
   * Indicates whether the state node is a history state node, and what
   * type of history:
   * shallow, deep, true (shallow), false (none), undefined (none)
   */
  history?: 'shallow' | 'deep' | boolean | undefined;
  states?:
    | Record<string, SimpleOrCompoundStateNodeConfig<TExtState>>
    | undefined;
  on?: Record<string, Transition<TExtState> | undefined>;
  onEntry?: Action | Action[];
  onExit?: Action | Action[];
  activities?: Activity[];
  parent?: StateNode;
  strict?: boolean | undefined;
  data?: object | undefined;
  id?: string | undefined;
  delimiter?: string;
}
export interface SimpleStateNodeConfig<TExtState>
  extends StateNodeConfig<TExtState> {
  initial?: undefined;
  parallel?: false | undefined;
  states?: undefined;
}

export interface HistoryStateNodeConfig<TExtState>
  extends SimpleStateNodeConfig<TExtState> {
  history: 'shallow' | 'deep' | true;
  target: StateValue | undefined;
}

export interface CompoundStateNodeConfig<TExtState>
  extends StateNodeConfig<TExtState> {
  initial?: string;
  parallel?: boolean;
  states: Record<string, SimpleOrCompoundStateNodeConfig<TExtState>>;
  history?: false | undefined;
}

export type SimpleOrCompoundStateNodeConfig<TExtState> =
  | CompoundStateNodeConfig<TExtState>
  | SimpleStateNodeConfig<TExtState>;

export interface MachineOptions<TExtState> {
  guards?: Record<string, ConditionPredicate>;
  actions?: Record<string, ActionObject | ActionFunction>;
}
export interface MachineConfig<TExtState>
  extends CompoundStateNodeConfig<TExtState> {
  key?: string;
  strict?: boolean;
  history?: false | undefined;
}
export interface StandardMachineConfig<TExtState>
  extends MachineConfig<TExtState> {
  initial: string;
  parallel?: false | undefined;
}

export interface ParallelMachineConfig<TExtState>
  extends MachineConfig<TExtState> {
  initial?: undefined;
  parallel: true;
}

export interface EntryExitEffectMap {
  entry: Action[];
  exit: Action[];
}

// export interface IStateNode<TExtState> {
//   key: string;
//   id: string;
//   initial: string | undefined;
//   parallel: boolean;
//   transient: boolean;
//   history: false | 'shallow' | 'deep';
//   states: Record<string, IStateNode<TExtState>>;
//   on?: Record<string, Transition<TExtState>>;
//   onEntry?: Action | Action[];
//   onExit?: Action | Action[];
//   parent: StateNode | undefined;
//   machine: Machine;
//   config: StateNodeConfig<TExtState>;
// }

export interface ComplexStateNode extends StateNode {
  initial: string;
  history: false;
}

export interface LeafStateNode extends StateNode {
  initial: never;
  parallel: never;
  states: never;
  parent: StateNode;
}

export interface HistoryStateNode extends StateNode {
  history: 'shallow' | 'deep';
  target: StateValue | undefined;
}

export interface Machine<TExtState> extends StateNode<TExtState> {
  id: string;
  initial: string | undefined;
  parallel: boolean;
  states: Record<string, StateNode<TExtState>>;
}

export interface StandardMachine<TExtState> extends Machine<TExtState> {
  initial: string;
  parallel: false;
}

export interface ParallelMachine<TExtState> extends Machine<TExtState> {
  initial: undefined;
  parallel: true;
}
export interface ActionMap {
  onEntry: Action[];
  actions: Action[];
  onExit: Action[];
}

export interface EntryExitStates {
  entry: Set<StateNode>;
  exit: Set<StateNode>;
}

export interface ActivityMap {
  [activityKey: string]: boolean;
}
export type MaybeStateValueActionsTuple = [
  StateValue | undefined,
  ActionMap,
  ActivityMap | undefined
];

// tslint:disable-next-line:class-name
export interface StateTransition {
  value: StateValue | undefined;
  entryExitStates: EntryExitStates | undefined;
  actions: Action[];
  paths: string[][];
}

export interface TransitionData {
  value: StateValue | undefined;
  actions: ActionMap;
  activities?: ActivityMap;
}

export interface ActivityAction extends ActionObject {
  activity: ActionType;
  data: {
    type: ActionType;
    [key: string]: any;
  };
  command?: ActionFunction;
}

export interface SendAction extends ActionObject {
  event: EventObject;
  delay?: number;
  id: string | number;
}
export interface SendActionOptions {
  delay?: number;
  id?: string | number;
}

export interface CancelAction extends ActionObject {
  sendId: string | number;
}

export interface Edge {
  event: string;
  source: StateNode;
  target: StateNode;
  cond?: Condition;
  actions: Action[];
  meta?: MetaObject;
}
export interface NodesAndEdges {
  nodes: StateNode[];
  edges: Edge[];
}

export interface Segment {
  /**
   * From state
   */
  state: StateValue;
  /**
   * Event from state
   */
  event: Event;
}

export interface PathMap {
  [key: string]: Segment[];
}

export interface PathItem {
  state: StateValue;
  path: Segment[];
}

export interface PathsItem {
  state: StateValue;
  paths: Segment[][];
}

export interface PathsMap {
  [key: string]: Segment[][];
}

export interface TransitionMap {
  state: StateValue | undefined;
}

export interface AdjacencyMap {
  [stateId: string]: Record<string, TransitionMap>;
}

export interface StateInterface<TExtState = any> {
  value: StateValue;
  history?: State;
  actions: Action[];
  activities: ActivityMap;
  data: Record<string, any>;
  events: EventObject[];
  ext?: TExtState;
}
