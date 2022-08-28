import {
  InvokeActionObject,
  BaseActionObject,
  AnyState,
  ActorContext,
  AnyInterpreter,
  EventObject,
  AnyStateMachine,
  ActionFunction,
  SendActionObject,
  SCXML,
  CancelActionObject,
  InvokeSourceDefinition,
  StopActionObject,
  LogActionObject,
  ActionFunctionMap,
  ContextFrom,
  EventFrom,
  AnyEventObject,
  ActorRef,
  toSCXMLEvent
} from '.';
import { isExecutableAction } from '../actions/ExecutableAction';
import { actionTypes, error } from './actions';
import { IS_PRODUCTION } from './environment';
import { isStateLike, isFunction, warn } from './utils';

export function execAction(
  action: InvokeActionObject | BaseActionObject,
  state: AnyState,
  actorContext: ActorContext<any, any> | undefined
): void {
  if (!actorContext) {
    return;
  }

  const interpreter = actorContext.self as AnyInterpreter;

  if (!isStateLike(state)) {
    return;
  }

  const { _event } = state;

  if (isExecutableAction(action) && action.type !== actionTypes.invoke) {
    try {
      return action.execute(state);
    } catch (err) {
      interpreter._parent?.send({
        type: 'xstate.error',
        data: err
      });

      throw err;
    }
  }

  const actionOrExec = getActionFunction(
    state,
    action.type,
    interpreter.behavior,
    actorContext
  );
  const exec = isFunction(actionOrExec) ? actionOrExec : undefined;

  if (exec) {
    try {
      return exec(state.context, _event.data, {
        action,
        state,
        _event
      });
    } catch (err) {
      if (interpreter._parent) {
        interpreter._parent.send({
          type: 'xstate.error',
          data: err
        } as EventObject);
      }

      throw err;
    }
  }

  if (!IS_PRODUCTION && !action.type?.startsWith('xstate.')) {
    warn(false, `No implementation found for action type '${action.type}'`);
  }

  return undefined;
}

function getActionFunction<TState extends AnyState>(
  state: TState,
  actionType: string,
  machine: AnyStateMachine,
  actorCtx: ActorContext<any, any>
): BaseActionObject | ActionFunction<any, any> | undefined {
  const interpreter = actorCtx.self as AnyInterpreter;

  return (
    machine.options.actions[actionType] ??
    ({
      [actionTypes.send]: (_ctx, _e, { action }) => {
        const sendAction = action as SendActionObject;

        if (typeof sendAction.params.delay === 'number') {
          interpreter.defer(sendAction);
          return;
        } else {
          if (sendAction.params.to) {
            const target = sendAction.params.to;
            execSendTo(sendAction.params._event, target, interpreter);
          } else {
            interpreter.send(sendAction.params._event as SCXML.Event<any>);
          }
        }
      },
      [actionTypes.cancel]: (_ctx, _e, { action }) => {
        interpreter.cancel((action as CancelActionObject).params.sendId);
      },
      [actionTypes.invoke]: (_ctx, _e, { action }) => {
        const { id, autoForward, ref } = (action as InvokeActionObject).params;
        if (!ref) {
          if (!IS_PRODUCTION) {
            warn(
              false,
              `Actor type '${
                ((action as InvokeActionObject).params
                  .src as InvokeSourceDefinition).type
              }' not found in machine '${interpreter.id}'.`
            );
          }
          return;
        }
        ref._parent = interpreter; // TODO: fix
        // If the actor didn't end up being in the state
        // (eg. going through transient states could stop it) don't bother starting the actor.
        if (!state.children[id]) {
          state.children[id] = ref;
        }
        actorCtx.defer?.(() => {
          try {
            if (autoForward) {
              interpreter._forwardTo.add(id);
            }

            ref.start?.();
          } catch (err) {
            interpreter.send(error(id, err));
            return;
          }
        });
      },
      [actionTypes.stop]: (_ctx, _e, { action }) => {
        const { actor } = (action as StopActionObject).params;

        if (actor) {
          actor.stop?.();
        }
      },
      [actionTypes.log]: (_ctx, _e, { action }) => {
        const { label, value } = (action as LogActionObject).params;

        if (label) {
          actorCtx.logger?.(label, value);
        } else {
          actorCtx.logger?.(value);
        }
      }
    } as ActionFunctionMap<ContextFrom<TState>, EventFrom<TState>>)[actionType]
  );
}

function execSendTo(
  event: SCXML.Event<AnyEventObject>,
  to: ActorRef<any>,
  interpreter: AnyInterpreter
) {
  const isParent = interpreter._parent;
  const target = to;

  if (!target) {
    if (!isParent) {
      const executionError = new Error(
        `Unable to send event to child '${to}' from service '${interpreter.name}'.`
      );
      interpreter.send(
        toSCXMLEvent<any>(actionTypes.errorExecution, {
          data: executionError as any // TODO: refine
        }) as any // TODO: fix
      );
    }

    // tslint:disable-next-line:no-console
    if (!IS_PRODUCTION) {
      warn(
        false,
        `Service '${interpreter.name}' has no parent: unable to send event ${event.type}`
      );
    }
    return;
  }

  target.send({
    ...event,
    name:
      event.name === actionTypes.error
        ? `${error(interpreter.name)}`
        : event.name,
    origin: interpreter
  });
}
