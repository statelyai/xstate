import { StateNode } from './StateNode';
import { State } from './State';
import { StateTree } from './StateTree';

export type EventType = string;
export type ActionType = string;
export type MetaObject = Record<string, any>;

export interface EventObject extends Record<string, any> {
  type: string;
  id?: string | number;
}

export interface ActionObject<TContext> extends Record<string, any> {
  type: string;
  exec?: ActionFunction<TContext>;
}

export type DefaultContext = Record<string, any> | undefined;

export type Event<TEvents extends EventObject> = TEvents['type'] | TEvents;

export interface ActionFunction<TContext> {
  (context: TContext, event?: EventObject): any | void;
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

export interface HistoryValue {
  states: Record<string, HistoryValue | undefined>;
  current: StateValue | undefined;
}

export type ConditionPredicate<TContext, TEvents extends EventObject> = (
  context: TContext,
  event: TEvents,
  microstepState: StateValue
) => boolean;

export type Condition<TContext, TEvents extends EventObject> =
  | string
  | ConditionPredicate<TContext, TEvents>;

export interface TransitionConfig<TContext, TEvents extends EventObject> {
  cond?: Condition<TContext, TEvents>;
  actions?: SingleOrArray<Action<TContext>>;
  in?: StateValue;
  internal?: boolean;
  target?: string | string[];
}

export interface TargetTransitionConfig<TContext, TEvents extends EventObject>
  extends TransitionConfig<TContext, TEvents> {
  target: string | string[] | undefined;
}

export type ConditionalTransitionConfig<
  TContext = DefaultContext,
  TEvents extends EventObject = EventObject
> = Array<TransitionConfig<TContext, TEvents>>;

export type Transition<TContext, TEvents extends EventObject = EventObject> =
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

export interface DelayedTransitionConfig<TContext, TEvents extends EventObject>
  extends TransitionConfig<TContext, TEvents> {
  delay: number;
}

export type DelayedTransitions<TContext, TEvents extends EventObject> =
  | Record<
      string,
      | string
      | TransitionConfig<TContext, TEvents>
      | Array<TransitionConfig<TContext, TEvents>>
    >
  | Array<DelayedTransitionConfig<TContext, TEvents>>;

export type StateTypes =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history';

export type SingleOrArray<T> = T[] | T;

export type StateNodesConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> = {
  [K in keyof TStateSchema['states']]: StateNode<
    TContext,
    TStateSchema['states'][K],
    TEvents
  >
};

export type StatesConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> = {
  [K in keyof TStateSchema['states']]: StateNodeConfig<
    TContext,
    TStateSchema['states'][K],
    TEvents
  >
};

export type StatesDefinition<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> = {
  [K in keyof TStateSchema['states']]: StateNodeDefinition<
    TContext,
    TStateSchema['states'][K],
    TEvents
  >
};

export type TransitionsConfig<TContext, TEvents extends EventObject> = {
  [K in TEvents['type'] | BuiltInEvent<TEvents>['type']]?:
    | string
    | TransitionConfig<
        TContext,
        TEvents extends { type: K } ? TEvents : EventObject
      >
    | Array<
        TransitionConfig<
          TContext,
          TEvents extends { type: K } ? TEvents : EventObject
        >
      >
};

export type TransitionsDefinition<TContext, TEvents extends EventObject> = {
  [K in TEvents['type']]: Array<
    TransitionDefinition<
      TContext,
      TEvents extends { type: K } ? TEvents : EventObject
    >
  >
};

export interface StateNodeConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> {
  key?: string;
  initial?: keyof TStateSchema['states'] | undefined;
  parallel?: boolean | undefined;
  type?: StateTypes;
  /**
   * The initial context (extended state).
   */
  context?: TContext;
  /**
   * Indicates whether the state node is a history state node, and what
   * type of history:
   * shallow, deep, true (shallow), false (none), undefined (none)
   */
  history?: 'shallow' | 'deep' | boolean | undefined;
  states?: StatesConfig<TContext, TStateSchema, TEvents> | undefined;
  // on?: Record<string, Transition<TContext> | undefined>;
  on?: TransitionsConfig<TContext, TEvents>;
  onEntry?: SingleOrArray<Action<TContext>>;
  onExit?: SingleOrArray<Action<TContext>>;
  after?: DelayedTransitions<TContext, TEvents>;
  activities?: SingleOrArray<Activity<TContext>>;
  parent?: StateNode<TContext>;
  strict?: boolean | undefined;
  data?: TStateSchema extends { data: infer D } ? D : any;
  id?: string | undefined;
  delimiter?: string;
  order?: number;
}

export interface StateNodeDefinition<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> extends StateNodeConfig<TContext, TStateSchema, TEvents> {
  id: string;
  key: string;
  type: StateTypes;
  initial: StateNodeConfig<TContext, TStateSchema, TEvents>['initial'];
  history: boolean | 'shallow' | 'deep' | undefined;
  states: StatesDefinition<TContext, TStateSchema, TEvents>;
  on: TransitionsDefinition<TContext, TEvents>;
  onEntry: Array<Action<TContext>>;
  onExit: Array<Action<TContext>>;
  after: Array<DelayedTransitionDefinition<TContext, TEvents>>;
  activities: Array<ActivityDefinition<TContext>>;
  data: any;
  order: number;
}
export interface SimpleStateNodeConfig<TContext, TEvents extends EventObject>
  extends StateNodeConfig<TContext, never, TEvents> {
  initial?: undefined;
  parallel?: false | undefined;
  states?: undefined;
}

export interface HistoryStateNodeConfig<TContext, TEvents extends EventObject>
  extends SimpleStateNodeConfig<TContext, TEvents> {
  history: 'shallow' | 'deep' | true;
  target: StateValue | undefined;
}

export interface CompoundStateNodeConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> extends StateNodeConfig<TContext, TStateSchema, TEvents> {
  parallel?: boolean;
  states: StateNodeConfig<TContext, TStateSchema, TEvents>['states'];
}

export type SimpleOrCompoundStateNodeConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> =
  | SimpleStateNodeConfig<TContext, TEvents>
  | CompoundStateNodeConfig<TContext, TStateSchema, TEvents>;

export type ActionFunctionMap<TContext> = Record<
  string,
  ActionObject<TContext> | ActionFunction<TContext>
>;

export interface MachineOptions<TContext, TEvents extends EventObject> {
  guards?: Record<string, ConditionPredicate<TContext, TEvents>>;
  actions?: ActionFunctionMap<TContext>;
  activities?: Record<string, ActivityConfig<TContext>>;
}
export interface MachineConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> extends CompoundStateNodeConfig<TContext, TStateSchema, TEvents> {
  /**
   * The initial context (extended state)
   */
  context?: TContext;
}

export interface StandardMachineConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> extends CompoundStateNodeConfig<TContext, TStateSchema, TEvents> {}

export interface ParallelMachineConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> extends CompoundStateNodeConfig<TContext, TStateSchema, TEvents> {
  initial?: undefined;
  type?: 'parallel';
}

export interface EntryExitEffectMap<TContext> {
  entry: Array<Action<TContext>>;
  exit: Array<Action<TContext>>;
}

export interface HistoryStateNode<TContext> extends StateNode<TContext> {
  history: 'shallow' | 'deep';
  target: StateValue | undefined;
}

export interface Machine<
  TContext,
  TStateSchema extends StateSchema,
  TEvents extends EventObject
> extends StateNode<TContext, TStateSchema, TEvents> {
  id: string;
  states: StateNode<TContext, TStateSchema, TEvents>['states'];
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

export interface EntryExitStateArrays<TContext> {
  entry: Array<StateNode<TContext>>;
  exit: Array<StateNode<TContext>>;
}

export interface ActivityMap {
  [activityKey: string]: boolean;
}

// tslint:disable-next-line:class-name
export interface StateTransition<TContext> {
  tree: StateTree | undefined;
  /**
   * The source state that preceded the transition.
   */
  source: State<TContext> | undefined;
  reentryStates: Set<StateNode<TContext>> | undefined;
  actions: Array<Action<TContext>>;
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
  Null = '',
  Assign = 'xstate.assign',
  After = 'xstate.after',
  DoneState = 'done.state',
  Log = 'xstate.log',
  Init = 'xstate.init'
}

export interface RaisedEvent<TEvents extends EventObject> {
  type: ActionTypes.Raise;
  event: TEvents;
}
export type BuiltInEvent<TEvents extends EventObject> =
  | { type: ActionTypes.Null }
  | RaisedEvent<TEvents>
  | { type: ActionTypes.Init };
export type AnyEvent<TEvents extends EventObject> =
  | TEvents
  | BuiltInEvent<TEvents>;

export interface ActivityActionObject<TContext> extends ActionObject<TContext> {
  type: ActionTypes.Start | ActionTypes.Stop;
  activity: ActivityDefinition<TContext>;
  exec: ActionFunction<TContext> | undefined;
}

export interface SendAction<TContext, TEvents extends EventObject>
  extends ActionObject<TContext> {
  event: TEvents;
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

export type Assigner<TContext, TEvents extends EventObject> = (
  extState: TContext,
  event: TEvents
) => Partial<TContext>;

export type PropertyAssigner<TContext, TEvents extends EventObject> = Partial<
  {
    [K in keyof TContext]:
      | ((extState: TContext, event: TEvents) => TContext[K])
      | TContext[K]
  }
>;

export interface AssignAction<TContext, TEvents extends EventObject>
  extends ActionObject<TContext> {
  assignment: Assigner<TContext, TEvents> | PropertyAssigner<TContext, TEvents>;
}

export interface TransitionDefinition<TContext, TEvents extends EventObject>
  extends TransitionConfig<TContext, TEvents> {
  actions: Array<Action<TContext>>;
  event: string;
  delay?: number;
}

export interface DelayedTransitionDefinition<
  TContext,
  TEvents extends EventObject
> extends TransitionDefinition<TContext, TEvents> {
  delay: number;
}

export interface Edge<
  TContext,
  TEvents extends EventObject,
  TEventType extends TEvents['type'] = string
> {
  event: TEventType;
  source: StateNode<TContext>;
  target: StateNode<TContext>;
  cond?: Condition<TContext, TEvents & { type: TEventType }>;
  actions: Array<Action<TContext>>;
  meta?: MetaObject;
  transition: TransitionDefinition<TContext, TEvents>;
}
export interface NodesAndEdges<TContext, TEvents extends EventObject> {
  nodes: StateNode[];
  edges: Array<Edge<TContext, TEvents, TEvents['type']>>;
}

export interface Segment<
  TContext = DefaultContext,
  TEvents extends EventObject = EventObject
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
  TEvents extends EventObject = EventObject
> {
  value: StateValue;
  history?: State<TContext>;
  actions: Array<Action<TContext>>;
  activities: ActivityMap;
  data: any;
  events: TEvents[];
  context: TContext;
  toStrings: () => string[];
}

export interface StateSchema {
  data?: any;
  states?: {
    [key: string]: StateSchema;
  };
}
