import { StateNode } from './StateNode';
import { State } from './State';
import { StateTree } from './StateTree';

export type EventType = string;
export type ActionType = string;
export type MetaObject = Record<string, any>;

/**
 * The full definition of an event, with a string `type`.
 */
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

/**
 * The full definition of an action, with a string `type` and an
 * `exec` implementation function.
 */
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

/**
 * The specified string event types or the specified event objects.
 */
export type Event<TEvent extends EventObject> = TEvent['type'] | TEvent;

/**
 * Represents the specified event types or the full event objects,
 * as well as the built in event types and/or objects.
 */
export type OmniEvent<TEvent extends EventObject> =
  | TEvent['type']
  | BuiltInEvent<TEvent>['type']
  | OmniEventObject<TEvent>;

export interface ExecMeta<TContext> {
  action: ActionObject<TContext>;
}

export interface ActionFunction<TContext> {
  (context: TContext, event: EventObject, meta: ExecMeta<TContext>): any | void;
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

export type ConditionPredicate<TContext, TEvent extends EventObject> = (
  context: TContext,
  event: TEvent,
  microstepState: StateValue
) => boolean;

export type Condition<TContext, TEvent extends EventObject> =
  | string
  | ConditionPredicate<TContext, TEvent>;

export interface TransitionConfig<TContext, TEvent extends EventObject> {
  cond?: Condition<TContext, TEvent>;
  actions?: SingleOrArray<Action<TContext>>;
  in?: StateValue;
  internal?: boolean;
  target?: string | string[];
  delay?: number;
}

export interface TargetTransitionConfig<TContext, TEvent extends EventObject>
  extends TransitionConfig<TContext, TEvent> {
  target: string | string[] | undefined;
}

export type ConditionalTransitionConfig<
  TContext,
  TEvent extends EventObject = EventObject
> = Array<TransitionConfig<TContext, TEvent>>;

export type Transition<TContext, TEvent extends EventObject = EventObject> =
  | string
  | TransitionConfig<TContext, TEvent>
  | ConditionalTransitionConfig<TContext, TEvent>;

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

export type Sender<TEvent extends EventObject> = (event: Event<TEvent>) => void;

/**
 * Returns either a Promises or a callback handler (for streams of events) given the
 * machine's current `context` and `event` that invoked the service.
 *
 * For Promises, the only events emitted to the parent will be:
 * - `done.invoke.<id>` with the `data` containing the resolved payload when the promise resolves, or:
 * - `error.execution` with the `data` containing the caught error, and `src` containing the service `id`.
 *
 * For callback handlers, the `sender` will be provided, which will send events to the parent service.
 *
 * @param context The current machine `context`
 * @param event The event that invoked the service
 */
export type InvokeCreator<TFinalContext, TContext> = (
  context: TContext,
  event: EventObject
) => Promise<TFinalContext> | ((sender: Sender<any>) => void | (() => void));

export interface InvokeDefinition<TContext, TEvent extends EventObject>
  extends ActivityDefinition<TContext> {
  /**
   * The source of the machine to be invoked, or the machine itself.
   */
  src: string | StateMachine<any, any, any> | InvokeCreator<any, TContext>;
  /**
   * Whether any events sent to the parent are forwarded to the invoked child machine.
   */
  forward?: boolean;
  /**
   * Data from the parent machine's context to set as the (partial or full) context
   * for the invoked child machine.
   *
   * Data should be mapped to match the child machine's context shape.
   */
  data?: Mapper<TContext, TEvent> | PropertyMapper<TContext, TEvent>;
}

export interface Delay {
  id: string;
  /**
   * The time to delay the event, in milliseconds.
   */
  delay: number;
}

export type DelayedTransitions<TContext, TEvent extends EventObject> =
  | Record<
      string | number,
      | string
      | TransitionConfig<TContext, TEvent>
      | Array<TransitionConfig<TContext, TEvent>>
    >
  | Array<TransitionConfig<TContext, TEvent> & { delay: number }>;

export type StateTypes =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history'
  | string; // TODO: figure out if TypeScript fixes this for unknown string types

export type SingleOrArray<T> = T[] | T;

export type StateNodesConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> = {
  [K in keyof TStateSchema['states']]: StateNode<
    TContext,
    TStateSchema['states'][K],
    TEvent
  >
};

export type StatesConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> = {
  [K in keyof TStateSchema['states']]: StateNodeConfig<
    TContext,
    TStateSchema['states'][K],
    TEvent
  >
};

export type StatesDefinition<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> = {
  [K in keyof TStateSchema['states']]: StateNodeDefinition<
    TContext,
    TStateSchema['states'][K],
    TEvent
  >
};

export type TransitionsConfig<TContext, TEvent extends EventObject> = {
  [K in TEvent['type'] | BuiltInEvent<TEvent>['type']]?:
    | string
    | StateNode<TContext>
    | TransitionConfig<
        TContext,
        TEvent extends { type: K } ? TEvent : EventObject
      >
    | Array<
        TransitionConfig<
          TContext,
          TEvent extends { type: K } ? TEvent : EventObject
        >
      >
};

export type TransitionsDefinition<TContext, TEvent extends EventObject> = {
  [K in TEvent['type']]: Array<
    TransitionDefinition<
      TContext,
      TEvent extends { type: K } ? TEvent : EventObject
    >
  >
};

export type InvokeConfig<TContext, TEvent extends EventObject> =
  | {
      /**
       * The unique identifier for the invoked machine. If not specified, this
       * will be the machine's own `id`, or the URL (from `src`).
       */
      id?: string;
      /**
       * The source of the machine to be invoked, or the machine itself.
       */
      src: string | StateMachine<any, any, any> | InvokeCreator<any, TContext>;
      /**
       * Whether any events sent to the parent are forwarded to the invoked child machine.
       */
      forward?: boolean;
      /**
       * Data from the parent machine's context to set as the (partial or full) context
       * for the invoked child machine.
       *
       * Data should be mapped to match the child machine's context shape.
       */
      data?: Mapper<TContext, TEvent> | PropertyMapper<TContext, TEvent>;
      /**
       * The transition to take upon the invoked child machine reaching its final top-level state.
       */
      onDone?:
        | string
        | SingleOrArray<TransitionConfig<TContext, DoneInvokeEvent<any>>>;
      /**
       * The transition to take upon the invoked child machine sending an error event.
       */
      onError?:
        | string
        | SingleOrArray<TransitionConfig<TContext, DoneInvokeEvent<any>>>;
    }
  | StateMachine<any, any, any>;

export type InvokesConfig<TContext, TEvent extends EventObject> = SingleOrArray<
  InvokeConfig<TContext, TEvent>
>;

export interface StateNodeConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
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
  states?: StatesConfig<TContext, TStateSchema, TEvent> | undefined;
  /**
   * The services to invoke upon entering this state node. These services will be stopped upon exiting this state node.
   */
  invoke?: InvokesConfig<TContext, TEvent>;
  /**
   * The mapping of event types to their potential transition(s).
   */
  on?: TransitionsConfig<TContext, TEvent>;
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
    | TransitionConfig<TContext, DoneEventObject>
    | Array<TransitionConfig<TContext, DoneEventObject>>;
  /**
   * The mapping (or array) of delays (in milliseconds) to their potential transition(s).
   * The delayed transitions are taken after the specified delay in an interpreter.
   */
  after?: DelayedTransitions<TContext, TEvent>;
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
   *
   * The data will be evaluated with the current `context` and placed on the `.data` property
   * of the event.
   */
  data?: Mapper<TContext, TEvent> | PropertyMapper<TContext, TEvent>;
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
  TEvent extends EventObject
> extends StateNodeConfig<TContext, TStateSchema, TEvent> {
  id: string;
  key: string;
  type: StateTypes;
  initial: StateNodeConfig<TContext, TStateSchema, TEvent>['initial'];
  history: boolean | 'shallow' | 'deep' | undefined;
  states: StatesDefinition<TContext, TStateSchema, TEvent>;
  on: TransitionsDefinition<TContext, TEvent>;
  onEntry: Array<ActionObject<TContext>>;
  onExit: Array<ActionObject<TContext>>;
  activities: Array<ActivityDefinition<TContext>>;
  meta: any;
  order: number;
  data?: FinalStateNodeConfig<TContext, TEvent>['data'];
}

export type AnyStateNodeDefinition = StateNodeDefinition<any, any, any>;
export interface AtomicStateNodeConfig<TContext, TEvent extends EventObject>
  extends StateNodeConfig<TContext, StateSchema, TEvent> {
  initial?: undefined;
  parallel?: false | undefined;
  states?: undefined;
  onDone?: undefined;
}

export interface HistoryStateNodeConfig<TContext, TEvent extends EventObject>
  extends AtomicStateNodeConfig<TContext, TEvent> {
  history: 'shallow' | 'deep' | true;
  target: StateValue | undefined;
}

export interface FinalStateNodeConfig<TContext, TEvent extends EventObject>
  extends AtomicStateNodeConfig<TContext, TEvent> {
  type: 'final';
  /**
   * The data to be sent with the "done.state.<id>" event. The data can be
   * static or dynamic (based on assigners).
   */
  data?: Assigner<TContext, TEvent> | PropertyAssigner<TContext, TEvent> | any;
}

export interface CompoundStateNodeConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> extends StateNodeConfig<TContext, TStateSchema, TEvent> {
  parallel?: boolean;
  states: StateNodeConfig<TContext, TStateSchema, TEvent>['states'];
}

export type SimpleOrCompoundStateNodeConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> =
  | AtomicStateNodeConfig<TContext, TEvent>
  | CompoundStateNodeConfig<TContext, TStateSchema, TEvent>;

export type ActionFunctionMap<TContext> = Record<
  string,
  ActionObject<TContext> | ActionFunction<TContext>
>;

export type ServiceConfig =
  | string // URL
  | StateNode
  | StateNodeDefinition<any, any, any>;

export interface MachineOptions<TContext, TEvent extends EventObject> {
  guards?: Record<string, ConditionPredicate<TContext, TEvent>>;
  actions?: ActionFunctionMap<TContext>;
  activities?: Record<string, ActivityConfig<TContext>>;
  services?: Record<string, ServiceConfig>;
}
export interface MachineConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> extends CompoundStateNodeConfig<TContext, TStateSchema, TEvent> {
  /**
   * The initial context (extended state)
   */
  context?: TContext;
}

export interface StandardMachineConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> extends CompoundStateNodeConfig<TContext, TStateSchema, TEvent> {}

export interface ParallelMachineConfig<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> extends CompoundStateNodeConfig<TContext, TStateSchema, TEvent> {
  initial?: undefined;
  type?: 'parallel';
}

export interface EntryExitEffectMap<TContext> {
  entry: Array<ActionObject<TContext>>;
  exit: Array<ActionObject<TContext>>;
}

export interface HistoryStateNode<TContext> extends StateNode<TContext> {
  history: 'shallow' | 'deep';
  target: StateValue | undefined;
}

export interface StateMachine<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject
> extends StateNode<TContext, TStateSchema, TEvent> {
  id: string;
  states: StateNode<TContext, TStateSchema, TEvent>['states'];
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
  actions: Array<ActionObject<TContext>>;
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
  NullEvent = '',
  Assign = 'xstate.assign',
  After = 'xstate.after',
  DoneState = 'done.state',
  DoneInvoke = 'done.invoke',
  Log = 'xstate.log',
  Init = 'xstate.init',
  Invoke = 'xstate.invoke',
  ErrorExecution = 'error.execution',
  ErrorCommunication = 'error.communication'
}

export interface RaisedEvent<TEvent extends EventObject> {
  type: ActionTypes.Raise;
  event: TEvent;
}
export interface RaiseEvent<TContext, TEvent extends EventObject>
  extends ActionObject<TContext> {
  event: Event<TEvent>;
}

export interface DoneInvokeEvent<TData> extends EventObject {
  type: ActionTypes.DoneInvoke;
  data: TData;
}

export interface ErrorExecutionEvent extends EventObject {
  src: string;
  type: ActionTypes.ErrorExecution;
  data: any;
}

export interface DoneEventObject extends EventObject {
  data?: any;
  toString(): string;
}

export type DoneEvent = DoneEventObject & string;

export type BuiltInEvent<TEvent extends EventObject> =
  | { type: ActionTypes.NullEvent }
  | { type: ActionTypes.Init }
  | RaisedEvent<TEvent>
  | ErrorExecutionEvent;

/**
 * Represents the specified events and the built-in internal events.
 */
export type OmniEventObject<TEvent extends EventObject> =
  | TEvent
  | BuiltInEvent<TEvent>;

export interface ActivityActionObject<TContext> extends ActionObject<TContext> {
  type: ActionTypes.Start | ActionTypes.Stop;
  activity: ActivityDefinition<TContext>;
  exec: ActionFunction<TContext> | undefined;
}

export interface SendAction<TContext, TEvent extends EventObject>
  extends ActionObject<TContext> {
  to: string | undefined;
  event: TEvent | SendExpr<TContext, TEvent>;
  delay?: number;
  id: string | number;
}

export interface SendActionObject<TContext, TEvent extends EventObject>
  extends SendAction<TContext, TEvent> {
  to: string | undefined;
  event: TEvent;
  delay?: number;
  id: string | number;
}

export type SendExpr<TContext, TEvent extends EventObject> = (
  context: TContext,
  event: TEvent
) => OmniEvent<TEvent>;

export enum SpecialTargets {
  Parent = '#_parent',
  Internal = '#_internal'
}

export interface SendActionOptions {
  id?: string | number;
  delay?: number;
  to?: string;
}

export interface CancelAction extends ActionObject<any> {
  sendId: string | number;
}

export type Assigner<TContext, TEvent extends EventObject> = (
  extState: TContext,
  event: TEvent
) => Partial<TContext>;

export type PropertyAssigner<TContext, TEvent extends EventObject> = Partial<
  {
    [K in keyof TContext]:
      | ((extState: TContext, event: TEvent) => TContext[K])
      | TContext[K]
  }
>;

export type Mapper<TContext, TEvent extends EventObject> = (
  extState: TContext,
  event: TEvent
) => any;

export type PropertyMapper<TContext, TEvent extends EventObject> = Partial<{
  [key: string]: ((extState: TContext, event: TEvent) => any) | any;
}>;

export interface AssignAction<TContext, TEvent extends EventObject>
  extends ActionObject<TContext> {
  assignment: Assigner<TContext, TEvent> | PropertyAssigner<TContext, TEvent>;
}

export interface TransitionDefinition<TContext, TEvent extends EventObject>
  extends TransitionConfig<TContext, TEvent> {
  actions: Array<ActionObject<TContext>>;
  event: string;
  delay?: number;
}

export interface DelayedTransitionDefinition<
  TContext,
  TEvent extends EventObject
> extends TransitionDefinition<TContext, TEvent> {
  delay: number;
}

export interface Edge<
  TContext,
  TEvent extends EventObject,
  TEventType extends TEvent['type'] = string
> {
  event: TEventType;
  source: StateNode<TContext>;
  target: StateNode<TContext>;
  cond?: Condition<TContext, TEvent & { type: TEventType }>;
  actions: Array<Action<TContext>>;
  meta?: MetaObject;
  transition: TransitionDefinition<TContext, TEvent>;
}
export interface NodesAndEdges<TContext, TEvent extends EventObject> {
  nodes: StateNode[];
  edges: Array<Edge<TContext, TEvent, TEvent['type']>>;
}

export interface Segment<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
> {
  /**
   * From state.
   */
  state: StateValue;
  /**
   * The context of the from state.
   */
  context?: TContext;
  /**
   * Event from state.
   */
  event: Event<TEvent>;
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
  TEvent extends EventObject = EventObject
> {
  value: StateValue;
  tree?: StateTree;
  history?: State<TContext>;
  historyValue?: HistoryValue | undefined;
  actions: Array<ActionObject<TContext>>;
  activities: ActivityMap;
  meta: any;
  events: TEvent[];
  context: TContext;
  toStrings: () => string[];
}

export interface StateConfig<TContext, TEvent extends EventObject> {
  value: StateValue;
  context: TContext;
  event: OmniEventObject<TEvent>;
  historyValue?: HistoryValue | undefined;
  history?: State<TContext>;
  actions?: Array<ActionObject<TContext>>;
  activities?: ActivityMap;
  meta?: any;
  events?: TEvent[];
  tree?: StateTree;
}

export interface StateSchema {
  meta?: any;
  states?: {
    [key: string]: StateSchema;
  };
}
