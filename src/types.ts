import { StateNode } from './StateNode';
import { State } from './State';

export type EventType = string | number;
export type ActionType = string | number;
export type MetaObject = Record<string, any>;

export interface EventObject {
  type: EventType;
  id?: string | number;
  [key: string]: any;
}
export interface ActionObject<TExtState> extends Record<string, any> {
  type: EventType;
  exec?: ActionFunction<TExtState>;
}

export type DefaultExtState = Record<string, any> | undefined;
export type DefaultData = Record<string, any>;

export type Event = EventType | EventObject;
export type InternalEvent = EventType | EventObject;
export interface ActionFunction<TExtState> {
  (extendedState: TExtState, event?: EventObject): any | void;
  name: string;
}
export type InternalAction<TExtState> = SendAction | AssignAction<TExtState>;
export type Action<TExtState> =
  | ActionType
  | ActionObject<TExtState>
  | InternalAction<TExtState>
  | ActionFunction<TExtState>;
export type StateKey = string | State<any>;

export interface StateValueMap {
  [key: string]: StateValue;
}

export type StateValue = string | StateValueMap;

export interface HistoryValue {
  states: Record<string, HistoryValue | undefined>;
  current: StateValue | undefined;
}

export type ConditionPredicate<TExtState> = (
  extendedState: TExtState,
  event: EventObject,
  microstepState: StateValue
) => boolean;

export type Condition<TExtState> = string | ConditionPredicate<TExtState>;

export interface TransitionConfig<TExtState = DefaultExtState> {
  cond?: Condition<TExtState>;
  actions?: Array<Action<TExtState>>;
  in?: StateValue;
  internal?: boolean;
  target?: string | string[];
}

export interface TargetTransitionConfig<TExtState = DefaultExtState>
  extends TransitionConfig<TExtState> {
  target: string | string[] | undefined;
}

export type ConditionalTransitionConfig<TExtState = DefaultExtState> = Array<
  TransitionConfig<TExtState>
>;

export type Transition<TExtState = DefaultExtState> =
  | string
  | Record<string, TransitionConfig<TExtState>>
  | ConditionalTransitionConfig<TExtState>;

export type Activity<TExtState> = string | ActionObject<TExtState>;

export interface StateNodeConfig<TExtState = DefaultExtState, TData = any> {
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
  onEntry?: Action<TExtState> | Array<Action<TExtState>>;
  onExit?: Action<TExtState> | Array<Action<TExtState>>;
  activities?: Array<Activity<TExtState>>;
  parent?: StateNode<TExtState>;
  strict?: boolean | undefined;
  data?: TData;
  id?: string | undefined;
  delimiter?: string;
  order?: number;
}

export interface StateNodeDefinition<TExtState = DefaultExtState, TData = any> {
  id: string;
  key: string;
  initial: string | undefined;
  parallel: boolean | undefined;
  history: false | 'shallow' | 'deep' | undefined;
  states: Record<string, StateNodeDefinition<TExtState>>;
  on: Record<string, Array<TransitionDefinition<TExtState>>>;
  onEntry: Array<Action<TExtState>>;
  onExit: Array<Action<TExtState>>;
  activities: Array<Activity<TExtState>>;
  data: TData;
  order: number;
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
  guards?: Record<string, ConditionPredicate<TExtState>>;
  actions?: Record<string, ActionObject<TExtState> | ActionFunction<TExtState>>;
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

export interface EntryExitEffectMap<TExtState> {
  entry: Array<Action<TExtState>>;
  exit: Array<Action<TExtState>>;
}

// export interface IStateNode<TExtState = DefaultExtState> {
//   key: string;
//   id: string;
//   initial: string | undefined;
//   parallel: boolean;
//   transient: boolean;
//   history: false | 'shallow' | 'deep';
//   states: Record<string, IStateNode<TExtState = DefaultExtState>>;
//   on?: Record<string, Transition<TExtState = DefaultExtState>>;
//   onEntry?: Action | Action[];
//   onExit?: Action | Action[];
//   parent: StateNode | undefined;
//   machine: Machine;
//   config: StateNodeConfig<TExtState = DefaultExtState>;
// }

export interface ComplexStateNode<TExtState> extends StateNode<TExtState> {
  initial: string;
  history: false;
}

export interface LeafStateNode<TExtState> extends StateNode<TExtState> {
  initial: never;
  parallel: never;
  states: never;
  parent: StateNode<TExtState>;
}

export interface HistoryStateNode<TExtState> extends StateNode<TExtState> {
  history: 'shallow' | 'deep';
  target: StateValue | undefined;
}

export interface Machine<TExtState = DefaultExtState>
  extends StateNode<TExtState> {
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
export interface ActionMap<TExtState> {
  onEntry: Array<Action<TExtState>>;
  actions: Array<Action<TExtState>>;
  onExit: Array<Action<TExtState>>;
}

export interface EntryExitStates<TExtState> {
  entry: Set<StateNode<TExtState>>;
  exit: Set<StateNode<TExtState>>;
}

export interface ActivityMap {
  [activityKey: string]: boolean;
}
export type MaybeStateValueActionsTuple<TExtState> = [
  StateValue | undefined,
  ActionMap<TExtState>,
  ActivityMap | undefined
];

// tslint:disable-next-line:class-name
export interface StateTransition<TExtState> {
  value: StateValue | undefined;
  entryExitStates: EntryExitStates<TExtState> | undefined;
  actions: Array<Action<TExtState>>;
  paths: string[][];
}

export interface TransitionData<TExtState> {
  value: StateValue | undefined;
  actions: ActionMap<TExtState>;
  activities?: ActivityMap;
}

export interface ActivityAction<TExtState> extends ActionObject<TExtState> {
  activity: ActionType;
  data: {
    type: ActionType;
    [key: string]: any;
  };
  command?: ActionFunction<TExtState>;
}

export interface SendAction extends ActionObject<any> {
  event: EventObject;
  delay?: number;
  id: string | number;
}
export interface SendActionOptions {
  delay?: number;
  id?: string | number;
}

export interface CancelAction extends ActionObject<any> {
  sendId: string | number;
}

export type Assigner<TExtState> = (
  extState: TExtState,
  event: EventObject
) => Partial<TExtState>;

export type PropertyAssigner<TExtState> = Partial<
  {
    [K in keyof TExtState]:
      | ((extState: TExtState, event: EventObject) => TExtState[K])
      | TExtState[K]
  }
>;

export interface AssignAction<TExtState> extends ActionObject<TExtState> {
  assignment: Assigner<TExtState> | PropertyAssigner<TExtState>;
}

export interface TransitionDefinition<TExtState>
  extends TransitionConfig<TExtState> {
  event: string;
}

export interface Edge<TExtState> {
  event: string;
  source: StateNode<TExtState>;
  target: StateNode<TExtState>;
  cond?: Condition<TExtState>;
  actions: Array<Action<TExtState>>;
  meta?: MetaObject;
  transition: TransitionDefinition<TExtState>;
}
export interface NodesAndEdges<TExtState> {
  nodes: StateNode[];
  edges: Array<Edge<TExtState>>;
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

export interface ValueTransitionMap {
  state: StateValue | undefined;
  ext: any;
}

export interface AdjacencyMap {
  [stateId: string]: Record<string, TransitionMap>;
}

export interface ValueAdjacencyMap {
  [stateId: string]: Record<string, ValueTransitionMap>;
}

export interface StateInterface<
  TExtState = DefaultExtState,
  TData = DefaultData
> {
  value: StateValue;
  history?: State<TExtState>;
  actions: Array<Action<TExtState>>;
  activities: ActivityMap;
  data: TData;
  events: EventObject[];
  ext: TExtState;
  toStrings: () => string[];
}
