import { StateNode } from './StateNode';
import { State } from './State';
import { StateTree } from './StateTree';

export type EventType = string;
export type ActionType = string;
export type MetaObject = Record<string, any>;

export interface EventObject extends Record<string, any> {
  /**
   * The type of event that is sent.
   */
  type: string;
  /**
   * The unique ID that identifies this specific event instance.
   */
  id?: string | number;
}

export interface ActionObject<TContext> extends Record<string, any> {
  /**
   * The type of action that is executed.
   */
  type: string;
  /**
   * The implementation for executing the action.
   */
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

/**
 * The string or object representing the state value relative to the parent state node.
 *
 * - For a child atomic state node, this is a string, e.g., `"pending"`.
 * - For complex state nodes, this is an object, e.g., `{ success: "someChildState" }`.
 */
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

export type DisposeActivityFunction = () => void;

export type ActivityConfig<TContext> = (
  ctx: TContext,
  activity: ActivityDefinition<TContext>
) => DisposeActivityFunction | void;

export type Activity<TContext> = string | ActivityDefinition<TContext>;

export interface ActivityDefinition<TContext> extends ActionObject<TContext> {
  id: string;
  type: string;
}

export interface Invocation<TContext> extends ActivityDefinition<TContext> {
  /**
   * The source of the machine to be invoked, or the machine itself.
   */
  src: string | Machine<any, any, any>;
  /**
   * Whether any events sent to the parent are forwarded to the invoked child machine.
   */
  forward?: boolean;
}

export interface Delay {
  id: string;
  /**
   * The time to delay the event, in milliseconds.
   */
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
  /**
   * The relative key of the state node, which represents its location in the overall state value.
   * This is automatically determined by the configuration shape via the key where it was defined.
   */
  key?: string;
  /**
   * The initial state node key.
   */
  initial?: keyof TStateSchema['states'] | undefined;
  /**
   * @deprecated
   */
  parallel?: boolean | undefined;
  /**
   * The type of this state node:
   *
   *  - `'atomic'` - no child state nodes
   *  - `'compound'` - nested child state nodes (XOR)
   *  - `'parallel'` - orthogonal nested child state nodes (AND)
   *  - `'history'` - history state node
   *  - `'final'` - final state node
   */
  type?: StateTypes;
  /**
   * The initial context (extended state) of the machine.
   */
  context?: TContext;
  /**
   * Indicates whether the state node is a history state node, and what
   * type of history:
   * shallow, deep, true (shallow), false (none), undefined (none)
   */
  history?: 'shallow' | 'deep' | boolean | undefined;
  /**
   * The mapping of state node keys to their state node configurations (recursive).
   */
  states?: StatesConfig<TContext, TStateSchema, TEvents> | undefined;
  /**
   * The mapping of event types to their potential transition(s).
   */
  on?: TransitionsConfig<TContext, TEvents>;
  /**
   * The action(s) to be executed upon entering the state node.
   */
  onEntry?: SingleOrArray<Action<TContext>>;
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  onExit?: SingleOrArray<Action<TContext>>;
  /**
   * The potential transition(s) to be taken upon reaching a final child state node.
   *
   * This is equivalent to defining a `[done(id)]` transition on this state node's `on` property.
   */
  onDone?:
    | string
    | TransitionConfig<TContext, { type: ActionTypes.DoneState }>
    | Array<TransitionConfig<TContext, { type: ActionTypes.DoneState }>>;
  /**
   * The mapping (or array) of delays (in milliseconds) to their potential transition(s).
   * The delayed transitions are taken after the specified delay in an interpreter.
   */
  after?: DelayedTransitions<TContext, TEvents>;
  /**
   * The activities to be started upon entering the state node,
   * and stopped upon exiting the state node.
   */
  activities?: SingleOrArray<Activity<TContext>>;
  /**
   * @private
   */
  parent?: StateNode<TContext>;
  strict?: boolean | undefined;
  /**
   * The meta data associated with this state node, which will be returned in State instances.
   */
  meta?: TStateSchema extends { meta: infer D } ? D : any;
  /**
   * The data sent with the "done.state._id_" event if this is a final state node.
   */
  data?: any;
  /**
   * The unique ID of the state node, which can be referenced as a transition target via the
   * `#id` syntax.
   */
  id?: string | undefined;
  /**
   * The string delimiter for serializing the path to a string. The default is "."
   */
  delimiter?: string;
  /**
   * The order this state node appears. Corresponds to the implicit SCXML document order.
   */
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
  activities: Array<ActivityDefinition<TContext>>;
  meta: any;
  order: number;
}
export interface AtomicStateNodeConfig<TContext, TEvents extends EventObject>
  extends StateNodeConfig<TContext, never, TEvents> {
  initial?: undefined;
  parallel?: false | undefined;
  states?: undefined;
  onDone?: undefined;
}

export interface HistoryStateNodeConfig<TContext, TEvents extends EventObject>
  extends AtomicStateNodeConfig<TContext, TEvents> {
  history: 'shallow' | 'deep' | true;
  target: StateValue | undefined;
}

export interface FinalStateNodeConfig<TContext, TEvents extends EventObject>
  extends AtomicStateNodeConfig<TContext, TEvents> {
  type: 'final';
  data?: any;
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
  | AtomicStateNodeConfig<TContext, TEvents>
  | CompoundStateNodeConfig<TContext, TStateSchema, TEvents>;

export type ActionFunctionMap<TContext> = Record<
  string,
  ActionObject<TContext> | ActionFunction<TContext>
>;

export type ServiceConfig =
  | string // URL
  | StateNode
  | StateNodeDefinition<any, any, any>;

export interface MachineOptions<TContext, TEvents extends EventObject> {
  guards?: Record<string, ConditionPredicate<TContext, TEvents>>;
  actions?: ActionFunctionMap<TContext>;
  activities?: Record<string, ActivityConfig<TContext>>;
  services?: Record<string, ServiceConfig>;
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
  DoneInvoke = 'done.invoke',
  Log = 'xstate.log',
  Init = 'xstate.init',
  Invoke = 'xstate.invoke'
}

export interface RaisedEvent<TEvents extends EventObject> {
  type: ActionTypes.Raise;
  event: TEvents;
}
export interface RaiseEvent<TContext, TEvents extends EventObject>
  extends ActionObject<TContext> {
  event: Event<TEvents>;
}

export interface DoneEventObject extends EventObject {
  data?: any;
  toString(): string;
}

export type DoneEvent = DoneEventObject & string;

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
  to: string | undefined;
  event: TEvents;
  delay?: number;
  id: string | number;
}

export enum SpecialTargets {
  Parent = '#_parent',
  Internal = '#_internal'
}

export interface SendActionOptions {
  id?: string | number;
  delay?: number;
  target?: string;
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
  tree?: StateTree;
  history?: State<TContext>;
  actions: Array<Action<TContext>>;
  activities: ActivityMap;
  meta: any;
  events: TEvents[];
  context: TContext;
  toStrings: () => string[];
}

export interface StateSchema {
  meta?: any;
  states?: {
    [key: string]: StateSchema;
  };
}
