import { StateNode } from './StateNode';
import { State } from './State';

export type EventType = string | number;
export type ActionType = string;
export type MetaObject = Record<string, any>;

export type EventWithPayload<TPayload extends Record<string, any>> = {
  type: EventType;
  id?: string | number;
} & TPayload;

export type EventObject<
  TEvents extends Events,
  TName extends keyof TEvents = string
> = EventWithPayload<TEvents[TName]>;
export interface ActionObject<TContext> extends Record<string, any> {
  type: string;
  exec?: ActionFunction<TContext>;
}

export type DefaultContext = Record<string, any> | undefined;

export type Event<
  TEvents extends Events,
  TName extends keyof TEvents = string
> = TName | EventObject<TEvents, TName>;

export interface ActionFunction<TContext> {
  (context: TContext, event?: EventObject<any>): any | void;
  name: string;
}
// export type InternalAction<TContext> = SendAction | AssignAction<TContext>;
export type Action<TContext> =
  | ActionType
  | ActionObject<TContext>
  | ActionFunction<TContext>;
export type StateKey = string | State<any>;

export interface StateValueMap {
  [key: string]: StateValue;
}

export type StateValue = string | StateValueMap;

export interface StateNodeValueTree {
  stateNode: StateNode<any>;
  parent?: StateNodeValueTree | undefined;
  value: Record<string, StateNodeValueTree> | undefined;
}
export interface HistoryValue {
  states: Record<string, HistoryValue | undefined>;
  current: StateValue | undefined;
}

export type ConditionPredicate<TContext, TEvents extends Events> = (
  context: TContext,
  event: EventObject<TEvents>,
  microstepState: StateValue
) => boolean;

export type Condition<TContext, TEvents extends Events> =
  | string
  | ConditionPredicate<TContext, TEvents>;

export interface TransitionConfig<
  TContext = DefaultContext,
  TEvents extends Events = any
> {
  cond?: Condition<TContext, TEvents>;
  actions?: SingleOrArray<Action<TContext>>;
  in?: StateValue;
  internal?: boolean;
  target?: string | string[];
}

export interface TargetTransitionConfig<TContext = DefaultContext>
  extends TransitionConfig<TContext> {
  target: string | string[] | undefined;
}

export type ConditionalTransitionConfig<
  TContext = DefaultContext,
  TEvents extends Events = any
> = Array<TransitionConfig<TContext, TEvents>>;

export type Transition<TContext, TEvents extends Events = any> =
  | string
  | TransitionConfig<TContext, TEvents>
  | ConditionalTransitionConfig<TContext, TEvents>;

export interface ActivityConfig<TContext> {
  start?: Action<TContext>;
  stop?: Action<TContext>;
}

export type Activity<TContext> = string | ActivityDefinition<TContext>;

export interface ActivityDefinition<TContext> extends ActionObject<TContext> {
  type: string;
  start?: ActionObject<TContext>;
  stop?: ActionObject<TContext>;
}

export interface Delay {
  id: string;
  delay: number;
}

export interface DelayedTransitionConfig<TContext>
  extends TransitionConfig<TContext> {
  delay: number;
}

export type DelayedTransitions<TContext> =
  | Record<
      string,
      string | TransitionConfig<TContext> | Array<TransitionConfig<TContext>>
    >
  | Array<DelayedTransitionConfig<TContext>>;

export type StateTypes =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history';

export type SingleOrArray<T> = T[] | T;

export interface StateNodeConfig<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvents extends Events = any
> {
  key?: string;
  initial?: keyof TStateSchema['states'] | undefined;
  parallel?: boolean | undefined;
  type?: StateTypes;
  /**
   * Indicates whether the state node is a history state node, and what
   * type of history:
   * shallow, deep, true (shallow), false (none), undefined (none)
   */
  history?: 'shallow' | 'deep' | boolean | undefined;
  states?:
    | {
        [K in keyof TStateSchema['states']]: StateNodeConfig<
          TContext,
          TStateSchema['states'][K]
        >
      }
    | undefined;
  // on?: Record<string, Transition<TContext> | undefined>;
  on?: { [K in keyof TEvents]: Transition<TContext, TEvents> | undefined };
  onEntry?: SingleOrArray<Action<TContext>>;
  onExit?: SingleOrArray<Action<TContext>>;
  after?: DelayedTransitions<TContext>;
  activities?: SingleOrArray<Activity<TContext>>;
  parent?: StateNode<TContext>;
  strict?: boolean | undefined;
  data?: TStateSchema extends { data: infer D } ? D : any;
  id?: string | undefined;
  delimiter?: string;
  order?: number;
}

export interface StateNodeDefinition<
  TContext = DefaultContext,
  TEvents extends Events = any
> extends StateNodeConfig<TContext> {
  id: string;
  key: string;
  type: StateTypes;
  initial: string | undefined;
  history: boolean | 'shallow' | 'deep' | undefined;
  states: Record<string, StateNodeDefinition<TContext>>;
  on: { [K in keyof TEvents]: Array<TransitionDefinition<TContext>> };
  onEntry: Array<Action<TContext>>;
  onExit: Array<Action<TContext>>;
  after: Array<DelayedTransitionDefinition<TContext>>;
  activities: Array<ActivityDefinition<TContext>>;
  data: any;
  order: number;
}
export interface SimpleStateNodeConfig<TContext>
  extends StateNodeConfig<TContext> {
  initial?: undefined;
  parallel?: false | undefined;
  states?: undefined;
}

export interface HistoryStateNodeConfig<TContext>
  extends SimpleStateNodeConfig<TContext> {
  history: 'shallow' | 'deep' | true;
  target: StateValue | undefined;
}

export interface CompoundStateNodeConfig<
  TContext,
  TStateSchema extends StateSchema = any
> extends StateNodeConfig<TContext, TStateSchema> {
  parallel?: boolean;
  states: StateNodeConfig<TContext, TStateSchema>['states'];
}

export type SimpleOrCompoundStateNodeConfig<
  TContext,
  TStateSchema extends StateSchema = any
> =
  | SimpleStateNodeConfig<TContext>
  | CompoundStateNodeConfig<TContext, TStateSchema>;

export type ActionFunctionMap<TContext> = Record<
  string,
  ActionObject<TContext> | ActionFunction<TContext>
>;

export interface MachineOptions<TContext, TEvents extends Events> {
  guards?: Record<string, ConditionPredicate<TContext, TEvents>>;
  actions?: ActionFunctionMap<TContext>;
  activities?: Record<string, ActivityConfig<TContext>>;
}
export type MachineConfig<
  TContext,
  TStateSchema extends StateSchema = any
> = CompoundStateNodeConfig<TContext, TStateSchema>;

export interface StandardMachineConfig<TContext>
  extends CompoundStateNodeConfig<TContext> {}

export interface ParallelMachineConfig<TContext>
  extends CompoundStateNodeConfig<TContext> {
  initial?: string | undefined;
  parallel?: true;
  type?: 'parallel';
}

export interface EntryExitEffectMap<TContext> {
  entry: Array<Action<TContext>>;
  exit: Array<Action<TContext>>;
}

// export interface IStateNode<TContext = DefaulTContext> {
//   key: string;
//   id: string;
//   initial: string | undefined;
//   parallel: boolean;
//   transient: boolean;
//   history: false | 'shallow' | 'deep';
//   states: Record<string, IStateNode<TContext = DefaulTContext>>;
//   on?: Record<string, Transition<TContext = DefaulTContext>>;
//   onEntry?: Action | Action[];
//   onExit?: Action | Action[];
//   parent: StateNode | undefined;
//   machine: Machine;
//   config: StateNodeConfig<TContext = DefaulTContext>;
// }

export interface ComplexStateNode<TContext> extends StateNode<TContext> {
  initial: string;
  history: false;
}

export interface LeafStateNode<TContext> extends StateNode<TContext> {
  initial: never;
  parallel: never;
  states: never;
  parent: StateNode<TContext>;
}

export interface HistoryStateNode<TContext> extends StateNode<TContext> {
  history: 'shallow' | 'deep';
  target: StateValue | undefined;
}

export interface Machine<TContext = DefaultContext>
  extends StateNode<TContext> {
  id: string;
  states: Record<string, StateNode<TContext>>;
}

export interface StandardMachine<TContext> extends Machine<TContext> {
  initial: string;
  parallel: false;
}

export interface ParallelMachine<TContext> extends Machine<TContext> {
  initial: undefined;
  parallel: true;
}
export interface ActionMap<TContext> {
  onEntry: Array<Action<TContext>>;
  actions: Array<Action<TContext>>;
  onExit: Array<Action<TContext>>;
}

export interface EntryExitStates<TContext> {
  entry: Set<StateNode<TContext>>;
  exit: Set<StateNode<TContext>>;
}

export interface ActivityMap {
  [activityKey: string]: boolean;
}

// tslint:disable-next-line:class-name
export interface StateTransition<TContext> {
  value: StateValue | undefined;
  source: State<TContext> | undefined;
  entryExitStates: EntryExitStates<TContext> | undefined;
  actions: Array<Action<TContext>>;
  paths: string[][];
}

export interface TransitionData<TContext> {
  value: StateValue | undefined;
  actions: ActionMap<TContext>;
  activities?: ActivityMap;
}

export enum ActionTypes {
  Start = 'xstate.start',
  Stop = 'xstate.stop',
  Raise = 'xstate.raise',
  Send = 'xstate.send',
  Cancel = 'xstate.cancel',
  Null = 'xstate.null',
  Assign = 'xstate.assign',
  After = 'xstate.after',
  DoneState = 'done.state',
  Log = 'xstate.log'
}

export interface ActivityActionObject<TContext> extends ActionObject<TContext> {
  type: ActionTypes.Start | ActionTypes.Stop;
  activity: ActivityDefinition<TContext>;
  exec: ActionFunction<TContext> | undefined;
}

export interface SendAction<TContext, TEvents extends Events>
  extends ActionObject<TContext> {
  event: EventObject<TEvents>;
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

export type Assigner<TContext, TEvents extends Events> = (
  extState: TContext,
  event: EventObject<TEvents>
) => Partial<TContext>;

export type PropertyAssigner<TContext, TEvents extends Events> = Partial<
  {
    [K in keyof TContext]:
      | ((extState: TContext, event: EventObject<TEvents>) => TContext[K])
      | TContext[K]
  }
>;

export interface AssignAction<TContext, TEvents extends Events>
  extends ActionObject<TContext> {
  assignment: Assigner<TContext, TEvents> | PropertyAssigner<TContext, TEvents>;
}

export interface TransitionDefinition<TContext>
  extends TransitionConfig<TContext> {
  actions: Array<Action<TContext>>;
  event: string;
  delay?: number;
}

export interface DelayedTransitionDefinition<TContext>
  extends TransitionDefinition<TContext> {
  delay: number;
}

export interface Edge<TContext, TEvents extends Events> {
  event: string;
  source: StateNode<TContext>;
  target: StateNode<TContext>;
  cond?: Condition<TContext, TEvents>;
  actions: Array<Action<TContext>>;
  meta?: MetaObject;
  transition: TransitionDefinition<TContext>;
}
export interface NodesAndEdges<TContext, TEvents extends Events> {
  nodes: StateNode[];
  edges: Array<Edge<TContext, TEvents>>;
}

export interface Segment<
  TContext = DefaultContext,
  TEvents extends Events = any
> {
  /**
   * From state
   */
  state: StateValue;
  /** */
  context?: TContext;
  /**
   * Event from state
   */
  event: Event<TEvents>;
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
  value: StateValue | undefined;
  context: any;
}

export interface AdjacencyMap {
  [stateId: string]: Record<string, TransitionMap>;
}

export interface ValueAdjacencyMap {
  [stateId: string]: Record<string, ValueTransitionMap>;
}

export interface StateInterface<
  TContext = DefaultContext,
  TEvents extends Events = any
> {
  value: StateValue;
  history?: State<TContext>;
  actions: Array<Action<TContext>>;
  activities: ActivityMap;
  data: any;
  events: Array<EventObject<TEvents>>;
  context: TContext;
  toStrings: () => string[];
}

export interface StateSchema {
  data?: any;
  states?: {
    [key: string]: StateSchema;
  };
}

export interface Events {
  [key: string]: object;
}
