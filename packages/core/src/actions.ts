import {
  Action,
  Event,
  EventObject,
  SingleOrArray,
  SendAction,
  SendActionOptions,
  CancelAction,
  ActionObject,
  ActionType,
  Assigner,
  PropertyAssigner,
  AssignAction,
  ActionFunction,
  ActionFunctionMap,
  ActivityActionObject,
  ActionTypes,
  ActivityDefinition,
  SpecialTargets,
  RaiseAction,
  RaiseActionObject,
  DoneEvent,
  ErrorPlatformEvent,
  DoneEventObject,
  SendExpr,
  SendActionObject,
  PureAction,
  LogExpr,
  LogAction,
  LogActionObject,
  DelayFunctionMap,
  SCXML,
  ExprWithMeta,
  ChooseCondition,
  ChooseAction,
  AnyEventObject,
  Expr,
  StopAction,
  StopActionObject,
  Cast,
  EventFrom,
  AnyActorRef,
  PredictableActionArgumentsExec,
  RaiseActionOptions,
  NoInfer,
  BaseActionObject,
  LowInfer
} from './types';
import * as actionTypes from './actionTypes';
import {
  getEventType,
  isFunction,
  isString,
  toEventObject,
  toSCXMLEvent,
  flatten,
  updateContext,
  warn,
  toGuard,
  evaluateGuard,
  toArray,
  isArray
} from './utils';
import { State } from './State';
import { StateNode } from './StateNode';
import { IS_PRODUCTION } from './environment';

export { actionTypes };

export const initEvent = toSCXMLEvent({ type: actionTypes.init });

export function getActionFunction<TContext, TEvent extends EventObject>(
  actionType: ActionType,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
):
  | ActionObject<TContext, TEvent>
  | ActionFunction<TContext, TEvent>
  | undefined {
  return actionFunctionMap
    ? actionFunctionMap[actionType] || undefined
    : undefined;
}

export function toActionObject<TContext, TEvent extends EventObject>(
  action: Action<TContext, TEvent>,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): ActionObject<TContext, TEvent> {
  let actionObject: ActionObject<TContext, TEvent>;

  if (isString(action) || typeof action === 'number') {
    const exec = getActionFunction(action, actionFunctionMap);
    if (isFunction(exec)) {
      actionObject = {
        type: action,
        exec
      } as any;
    } else if (exec) {
      actionObject = exec;
    } else {
      actionObject = { type: action, exec: undefined } as any;
    }
  } else if (isFunction(action)) {
    actionObject = {
      // Convert action to string if unnamed
      type: action.name || action.toString(),
      exec: action
    } as any;
  } else {
    const exec = getActionFunction((action as any).type, actionFunctionMap);
    if (isFunction(exec)) {
      actionObject = {
        ...(action as any),
        exec
      };
    } else if (exec) {
      const actionType = (exec as any).type || (action as any).type;

      actionObject = {
        ...(exec as any),
        ...(action as any),
        type: actionType
      } as ActionObject<TContext, TEvent>;
    } else {
      actionObject = action as any;
    }
  }
  return actionObject;
}

export const toActionObjects = <TContext, TEvent extends EventObject>(
  action?: SingleOrArray<Action<TContext, TEvent>> | undefined,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): Array<ActionObject<TContext, TEvent>> => {
  if (!action) {
    return [];
  }

  const actions = isArray(action) ? action : [action];

  return actions.map((subAction) =>
    toActionObject(subAction, actionFunctionMap)
  );
};

export function toActivityDefinition<TContext, TEvent extends EventObject>(
  action: string | ActivityDefinition<TContext, TEvent>
): ActivityDefinition<TContext, TEvent> {
  const actionObject = toActionObject(action);

  return {
    id: isString(action) ? action : (actionObject as any).id,
    ...actionObject,
    type: actionObject.type
  } as any;
}

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */
export function raise<
  TContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  event: NoInfer<Event<TEvent>> | SendExpr<TContext, TExpressionEvent, TEvent>,
  options?: RaiseActionOptions<TContext, TExpressionEvent>
): RaiseAction<TContext, TExpressionEvent, TEvent> {
  return {
    type: actionTypes.raise,
    event: typeof event === 'function' ? event : toEventObject<any>(event),
    delay: options ? options.delay : undefined,
    id: options?.id
  } as any;
}

export function resolveRaise<
  TContext,
  TEvent extends EventObject,
  TExpressionEvent extends EventObject
>(
  action: RaiseAction<TContext, TExpressionEvent, TEvent>,
  ctx: TContext,
  _event: SCXML.Event<TExpressionEvent>,
  delaysMap?: DelayFunctionMap<TContext, TEvent>
): RaiseActionObject<TContext, TExpressionEvent, TEvent> {
  const meta = {
    _event
  };
  const resolvedEvent = toSCXMLEvent(
    isFunction(action.event)
      ? action.event(ctx, _event.data, meta)
      : action.event
  );

  let resolvedDelay: number | undefined;
  if (isString(action.delay)) {
    const configDelay = delaysMap && delaysMap[action.delay];
    resolvedDelay = isFunction(configDelay)
      ? configDelay(ctx, _event.data as any, meta as any)
      : configDelay;
  } else {
    resolvedDelay = isFunction(action.delay)
      ? action.delay(ctx, _event.data, meta)
      : action.delay;
  }
  return {
    ...action,
    type: actionTypes.raise,
    _event: resolvedEvent,
    delay: resolvedDelay
  } as any;
}

/**
 * Sends an event. This returns an action that will be read by an interpreter to
 * send the event in the next step, after the current step is finished executing.
 *
 * @deprecated Use the `sendTo(...)` action creator instead.
 *
 * @param event The event to send.
 * @param options Options to pass into the send event:
 *  - `id` - The unique send event identifier (used with `cancel()`).
 *  - `delay` - The number of milliseconds to delay the sending of the event.
 *  - `to` - The target of this event (by default, the machine the event was sent from).
 */
export function send<
  TContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: Event<AnyEventObject> | SendExpr<TContext, TEvent, AnyEventObject>,
  options?: SendActionOptions<TContext, TEvent>
): SendAction<TContext, TEvent, TSentEvent> {
  return {
    to: options ? options.to : undefined,
    type: actionTypes.send,
    event: isFunction(event) ? event : toEventObject(event),
    delay: options ? options.delay : undefined,
    // TODO: don't auto-generate IDs here like that
    // there is too big chance of the ID collision
    id:
      options && options.id !== undefined
        ? options.id
        : isFunction(event)
        ? event.name
        : (getEventType(event) as string)
  } as any;
}

export function resolveSend<
  TContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject
>(
  action: SendAction<TContext, TEvent, TSentEvent>,
  ctx: TContext,
  _event: SCXML.Event<TEvent>,
  delaysMap?: DelayFunctionMap<TContext, TEvent>
): SendActionObject<TContext, TEvent, TSentEvent> {
  const meta = {
    _event
  };

  // TODO: helper function for resolving Expr
  const resolvedEvent = toSCXMLEvent(
    isFunction(action.event)
      ? action.event(ctx, _event.data, meta)
      : action.event
  );

  let resolvedDelay: number | undefined;
  if (isString(action.delay)) {
    const configDelay = delaysMap && delaysMap[action.delay];
    resolvedDelay = isFunction(configDelay)
      ? configDelay(ctx, _event.data, meta)
      : configDelay;
  } else {
    resolvedDelay = isFunction(action.delay)
      ? action.delay(ctx, _event.data, meta)
      : action.delay;
  }

  const resolvedTarget = isFunction(action.to)
    ? action.to(ctx, _event.data, meta)
    : action.to;

  return {
    ...action,
    to: resolvedTarget,
    _event: resolvedEvent,
    event: resolvedEvent.data,
    delay: resolvedDelay
  } as any;
}

/**
 * Sends an event to this machine's parent.
 *
 * @param event The event to send to the parent machine.
 * @param options Options to pass into the send event.
 */
export function sendParent<
  TContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: Event<AnyEventObject> | SendExpr<TContext, TEvent, AnyEventObject>,
  options?: SendActionOptions<TContext, TEvent>
): SendAction<TContext, TEvent, TSentEvent> {
  return send<TContext, TEvent, TSentEvent>(event, {
    ...options,
    to: SpecialTargets.Parent
  });
}

type InferEvent<E extends EventObject> = {
  [T in E['type']]: { type: T } & Extract<E, { type: T }>;
}[E['type']];

/**
 * Sends an event to an actor.
 *
 * @param actor The `ActorRef` to send the event to.
 * @param event The event to send, or an expression that evaluates to the event to send
 * @param options Send action options
 * @returns An XState send action object
 */
export function sendTo<
  TContext,
  TEvent extends EventObject,
  TActor extends AnyActorRef
>(
  actor: string | TActor | ((ctx: TContext, event: TEvent) => TActor),
  event:
    | EventFrom<TActor>
    | SendExpr<
        TContext,
        TEvent,
        InferEvent<Cast<EventFrom<TActor>, EventObject>>
      >,
  options?: SendActionOptions<TContext, TEvent>
): SendAction<TContext, TEvent, any> {
  return send<TContext, TEvent, any>(event, {
    ...options,
    to: actor
  });
}

/**
 * Sends an update event to this machine's parent.
 */
export function sendUpdate<TContext, TEvent extends EventObject>(): SendAction<
  TContext,
  TEvent,
  any
> {
  return sendParent(actionTypes.update);
}

/**
 * Sends an event back to the sender of the original event.
 *
 * @param event The event to send back to the sender
 * @param options Options to pass into the send event
 */
export function respond<
  TContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: Event<TEvent> | SendExpr<TContext, TEvent, TSentEvent>,
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent>(event, {
    ...options,
    to: (_, __, { _event }) => {
      return _event.origin!; // TODO: handle when _event.origin is undefined
    }
  });
}

const defaultLogExpr = <TContext, TEvent extends EventObject>(
  context: TContext,
  event: TEvent
) => ({
  context,
  event
});

/**
 *
 * @param expr The expression function to evaluate which will be logged.
 *  Takes in 2 arguments:
 *  - `ctx` - the current state context
 *  - `event` - the event that caused this action to be executed.
 * @param label The label to give to the logged expression.
 */
export function log<
  TContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  expr: string | LogExpr<TContext, TExpressionEvent> = defaultLogExpr,
  label?: string
): LogAction<TContext, TExpressionEvent, TEvent> {
  return {
    type: actionTypes.log,
    label,
    expr
  } as any;
}

export const resolveLog = <TContext, TEvent extends EventObject>(
  action: LogAction<TContext, TEvent>,
  ctx: TContext,
  _event: SCXML.Event<TEvent>
): LogActionObject<TContext, TEvent> =>
  ({
    // TODO: remove .expr from resulting object
    ...action,
    value: isString(action.expr)
      ? action.expr
      : action.expr(ctx, _event.data, {
          _event
        })
  } as any);

/**
 * Cancels an in-flight `send(...)` action. A canceled sent action will not
 * be executed, nor will its event be sent, unless it has already been sent
 * (e.g., if `cancel(...)` is called after the `send(...)` action's `delay`).
 *
 * @param sendId The `id` of the `send(...)` action to cancel.
 */
export const cancel = <
  TContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>(
  sendId: string | number
): CancelAction<TContext, TExpressionEvent, TEvent> => {
  return {
    type: actionTypes.cancel,
    sendId
  } as any;
};

/**
 * Starts an activity.
 *
 * @param activity The activity to start.
 */
export function start<TContext, TEvent extends EventObject>(
  activity: string | ActivityDefinition<TContext, TEvent>
): ActivityActionObject<TContext, TEvent> {
  const activityDef = toActivityDefinition(activity);

  return {
    type: ActionTypes.Start,
    activity: activityDef,
    exec: undefined
  } as any;
}

/**
 * Stops an activity.
 *
 * @param actorRef The activity to stop.
 */
export function stop<
  TContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  actorRef: string | Expr<TContext, TExpressionEvent, string | { id: string }>
): StopAction<TContext, TExpressionEvent, TEvent> {
  const activity = isFunction(actorRef)
    ? actorRef
    : toActivityDefinition(actorRef);

  return {
    type: ActionTypes.Stop,
    activity,
    exec: undefined
  } as any;
}

export function resolveStop<TContext, TEvent extends EventObject>(
  action: StopAction<TContext, TEvent>,
  context: TContext,
  _event: SCXML.Event<TEvent>
): StopActionObject {
  const actorRefOrString = isFunction(action.activity)
    ? action.activity(context, _event.data)
    : action.activity;
  const resolvedActorRef =
    typeof actorRefOrString === 'string'
      ? { id: actorRefOrString }
      : actorRefOrString;

  const actionObject = {
    type: ActionTypes.Stop as const,
    activity: resolvedActorRef
  };

  return actionObject;
}

/**
 * Updates the current context of the machine.
 *
 * @param assignment An object that represents the partial context to update.
 */
export const assign = <
  TContext,
  TExpressionEvent extends EventObject = EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  assignment:
    | Assigner<LowInfer<TContext>, TExpressionEvent>
    | PropertyAssigner<LowInfer<TContext>, TExpressionEvent>
): AssignAction<TContext, TExpressionEvent, TEvent> => {
  return {
    type: actionTypes.assign,
    assignment
  } as any;
};

export function isActionObject<TContext, TEvent extends EventObject>(
  action: Action<TContext, TEvent>
): action is ActionObject<TContext, TEvent> {
  return typeof action === 'object' && 'type' in action;
}

/**
 * Returns an event type that represents an implicit event that
 * is sent after the specified `delay`.
 *
 * @param delayRef The delay in milliseconds
 * @param id The state node ID where this event is handled
 */
export function after(delayRef: number | string, id?: string) {
  const idSuffix = id ? `#${id}` : '';
  return `${ActionTypes.After}(${delayRef})${idSuffix}`;
}

/**
 * Returns an event that represents that a final state node
 * has been reached in the parent state node.
 *
 * @param id The final state node's parent state node `id`
 * @param data The data to pass into the event
 */
export function done(id: string, data?: any): DoneEventObject {
  const type = `${ActionTypes.DoneState}.${id}`;
  const eventObject = {
    type,
    data
  };

  eventObject.toString = () => type;

  return eventObject as DoneEvent;
}

/**
 * Returns an event that represents that an invoked service has terminated.
 *
 * An invoked service is terminated when it has reached a top-level final state node,
 * but not when it is canceled.
 *
 * @param id The final state node ID
 * @param data The data to pass into the event
 */
export function doneInvoke(id: string, data?: any): DoneEvent {
  const type = `${ActionTypes.DoneInvoke}.${id}`;
  const eventObject = {
    type,
    data
  };

  eventObject.toString = () => type;

  return eventObject as DoneEvent;
}

export function error(id: string, data?: any): ErrorPlatformEvent & string {
  const type = `${ActionTypes.ErrorPlatform}.${id}`;
  const eventObject = { type, data };

  eventObject.toString = () => type;

  return eventObject as ErrorPlatformEvent & string;
}

export function pure<
  TContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  getActions: (
    context: TContext,
    event: TExpressionEvent
  ) =>
    | SingleOrArray<
        | BaseActionObject
        | BaseActionObject['type']
        | ActionObject<TContext, TExpressionEvent, TEvent>
        | ActionFunction<TContext, TExpressionEvent>
      >
    | undefined
): PureAction<TContext, TExpressionEvent, TEvent> {
  return {
    type: ActionTypes.Pure,
    get: getActions
  } as any;
}

/**
 * Forwards (sends) an event to a specified service.
 *
 * @param target The target service to forward the event to.
 * @param options Options to pass into the send action creator.
 */
export function forwardTo<TContext, TEvent extends EventObject>(
  target: Required<SendActionOptions<TContext, TEvent>>['to'],
  options?: SendActionOptions<TContext, TEvent>
): SendAction<TContext, TEvent, any> {
  if (!IS_PRODUCTION && (!target || typeof target === 'function')) {
    const originalTarget = target;
    target = (...args) => {
      const resolvedTarget =
        typeof originalTarget === 'function'
          ? originalTarget(...args)
          : originalTarget;
      if (!resolvedTarget) {
        throw new Error(
          `Attempted to forward event to undefined actor. This risks an infinite loop in the sender.`
        );
      }
      return resolvedTarget;
    };
  }
  return send<TContext, TEvent>((_, event) => event, {
    ...options,
    to: target
  });
}

/**
 * Escalates an error by sending it as an event to this machine's parent.
 *
 * @param errorData The error data to send, or the expression function that
 * takes in the `context`, `event`, and `meta`, and returns the error data to send.
 * @param options Options to pass into the send action creator.
 */
export function escalate<
  TContext,
  TEvent extends EventObject,
  TErrorData = any
>(
  errorData: TErrorData | ExprWithMeta<TContext, TEvent, TErrorData>,
  options?: SendActionOptions<TContext, TEvent>
): SendAction<TContext, TEvent, any> {
  return sendParent<TContext, TEvent>(
    (context, event, meta) => {
      return {
        type: actionTypes.error,
        data: isFunction(errorData)
          ? errorData(context, event, meta)
          : errorData
      };
    },
    {
      ...options,
      to: SpecialTargets.Parent
    }
  );
}

export function choose<
  TContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  conds: Array<ChooseCondition<TContext, TExpressionEvent, TEvent>>
): ChooseAction<TContext, TExpressionEvent, TEvent> {
  return {
    type: ActionTypes.Choose,
    conds
  } as any;
}

const pluckAssigns = <TContext, TEvent extends EventObject>(
  actionBlocks: Array<{
    type: string;
    actions: Array<ActionObject<TContext, TEvent>>;
  }>
): AssignAction<TContext, TEvent>[] => {
  const assignActions: AssignAction<TContext, TEvent>[] = [];

  for (const block of actionBlocks) {
    let i = 0;
    while (i < block.actions.length) {
      if (block.actions[i].type === actionTypes.assign) {
        assignActions.push(block.actions[i] as AssignAction<TContext, TEvent>);
        block.actions.splice(i, 1);
        continue;
      }
      i++;
    }
  }

  return assignActions;
};

export function resolveActions<TContext, TEvent extends EventObject>(
  machine: StateNode<TContext, any, TEvent, any, any, any>,
  currentState: State<TContext, TEvent, any, any, any> | undefined,
  currentContext: TContext,
  _event: SCXML.Event<TEvent>,
  actionBlocks: Array<{
    type: string;
    actions: Array<ActionObject<TContext, TEvent>>;
  }>,
  predictableExec?: PredictableActionArgumentsExec,
  preserveActionOrder: boolean = false
): [Array<ActionObject<TContext, TEvent>>, TContext] {
  const assignActions = preserveActionOrder ? [] : pluckAssigns(actionBlocks);

  let updatedContext = assignActions.length
    ? updateContext(currentContext, _event, assignActions, currentState)
    : currentContext;

  const preservedContexts: TContext[] | undefined = preserveActionOrder
    ? [currentContext]
    : undefined;

  const deferredToBlockEnd: Array<ActionObject<TContext, TEvent>> = [];

  function handleAction(
    blockType: string,
    actionObject: ActionObject<TContext, TEvent>
  ) {
    switch (actionObject.type) {
      case actionTypes.raise: {
        const raisedAction = resolveRaise(
          actionObject as RaiseAction<TContext, TEvent>,
          updatedContext,
          _event,
          machine.options.delays as any
        );
        if (predictableExec && typeof raisedAction.delay === 'number') {
          predictableExec(raisedAction as any, updatedContext, _event);
        }
        return raisedAction;
      }
      case actionTypes.send:
        const sendAction = resolveSend(
          actionObject as SendAction<TContext, TEvent, any>,
          updatedContext,
          _event,
          machine.options.delays as any
        ) as SendActionObject<TContext, TEvent>; // TODO: fix ActionTypes.Init

        if (!IS_PRODUCTION) {
          const configuredDelay = (
            actionObject as SendAction<TContext, TEvent, any>
          ).delay;
          // warn after resolving as we can create better contextual message here
          warn(
            !isString(configuredDelay) || typeof sendAction.delay === 'number',
            // tslint:disable-next-line:max-line-length
            `No delay reference for delay expression '${configuredDelay}' was found on machine '${machine.id}'`
          );
        }

        if (predictableExec && sendAction.to !== SpecialTargets.Internal) {
          if (blockType === 'entry') {
            deferredToBlockEnd.push(sendAction);
          } else {
            predictableExec(sendAction, updatedContext, _event);
          }
        }

        return sendAction;
      case actionTypes.log: {
        const resolved = resolveLog(
          actionObject as LogAction<TContext, TEvent>,
          updatedContext,
          _event
        );
        predictableExec?.(resolved, updatedContext, _event);
        return resolved;
      }
      case actionTypes.choose: {
        const chooseAction = actionObject as ChooseAction<TContext, TEvent>;
        const matchedActions = chooseAction.conds.find((condition) => {
          const guard = toGuard(condition.cond, machine.options.guards as any);
          return (
            !guard ||
            evaluateGuard(
              machine,
              guard,
              updatedContext,
              _event,
              (!predictableExec ? currentState : undefined) as any
            )
          );
        })?.actions;

        if (!matchedActions) {
          return [];
        }

        const [resolvedActionsFromChoose, resolvedContextFromChoose] =
          resolveActions(
            machine,
            currentState,
            updatedContext,
            _event,
            [
              {
                type: blockType,
                actions: toActionObjects(
                  toArray(matchedActions),
                  machine.options.actions as any
                )
              }
            ],
            predictableExec,
            preserveActionOrder
          );
        updatedContext = resolvedContextFromChoose;
        preservedContexts?.push(updatedContext);
        return resolvedActionsFromChoose;
      }
      case actionTypes.pure: {
        const matchedActions = (
          actionObject as PureAction<TContext, TEvent>
        ).get(updatedContext, _event.data);
        if (!matchedActions) {
          return [];
        }
        const [resolvedActionsFromPure, resolvedContext] = resolveActions(
          machine,
          currentState,
          updatedContext,
          _event,
          [
            {
              type: blockType,
              actions: toActionObjects(
                toArray(matchedActions),
                machine.options.actions as any
              )
            }
          ],
          predictableExec,
          preserveActionOrder
        );
        updatedContext = resolvedContext;
        preservedContexts?.push(updatedContext);
        return resolvedActionsFromPure;
      }
      case actionTypes.stop: {
        const resolved = resolveStop(
          actionObject as StopAction<TContext, TEvent>,
          updatedContext,
          _event
        ) as any;

        predictableExec?.(resolved, currentContext, _event);
        return resolved;
      }
      case actionTypes.assign: {
        updatedContext = updateContext(
          updatedContext,
          _event,
          [actionObject as AssignAction<TContext, TEvent>],
          !predictableExec ? currentState : undefined
        );
        preservedContexts?.push(updatedContext);
        break;
      }
      default:
        let resolvedActionObject = toActionObject(
          actionObject,
          machine.options.actions as any
        );
        const { exec } = resolvedActionObject;
        if (predictableExec) {
          predictableExec(resolvedActionObject, updatedContext, _event);
        } else if (exec && preservedContexts) {
          const contextIndex = preservedContexts.length - 1;
          const wrapped = {
            ...resolvedActionObject,
            exec: (_ctx, ...args) => {
              (exec as any)(preservedContexts[contextIndex], ...args);
            }
          };
          resolvedActionObject = wrapped as any;
        }
        return resolvedActionObject;
    }
  }

  function processBlock(block: {
    type: string;
    actions: ActionObject<TContext, TEvent>[];
  }) {
    let resolvedActions: Array<ActionObject<TContext, TEvent>> = [];

    for (const action of block.actions) {
      const resolved = handleAction(block.type, action);
      if (resolved) {
        resolvedActions = resolvedActions.concat(resolved);
      }
    }

    deferredToBlockEnd.forEach((action) => {
      predictableExec!(action, updatedContext, _event);
    });
    deferredToBlockEnd.length = 0;

    return resolvedActions;
  }

  const resolvedActions = flatten(actionBlocks.map(processBlock));
  return [resolvedActions, updatedContext];
}
