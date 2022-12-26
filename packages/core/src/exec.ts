import {
  InvokeActionObject,
  BaseActionObject,
  AnyState,
  ActorContext,
  AnyInterpreter,
  EventObject,
  ActionFunction,
  SendActionObject,
  CancelActionObject,
  InvokeSourceDefinition,
  StopActionObject,
  LogActionObject,
  ActionFunctionMap,
  ContextFrom,
  EventFrom
} from '.';
import { actionTypes, error } from './actions';
import { devLog } from './dev';
import { IS_PRODUCTION } from './environment';
import { isFunction, warn } from './utils';

export function execAction(
  action: InvokeActionObject | BaseActionObject,
  state: AnyState,
  actorContext: ActorContext<any, any>
): void {
  devLog('executing', action.type);
  const interpreter = actorContext.self as AnyInterpreter;

  const { _event } = state;

  const actionOrExec = getActionFunction(state, action.type, actorContext);
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
}

function getActionFunction<TState extends AnyState>(
  state: TState,
  actionType: string,
  actorCtx: ActorContext<any, any>
): BaseActionObject | ActionFunction<any, any> | undefined {
  const interpreter = actorCtx.self as AnyInterpreter;

  return ({
    [actionTypes.send]: (_ctx, _e, { action }) => {
      const sendAction = action as SendActionObject;

      if (typeof sendAction.params.delay === 'number') {
        interpreter.defer(sendAction);
        return;
      } else {
        const target = sendAction.params.to!;
        const { _event } = sendAction.params;
        actorCtx.defer?.(() => {
          const origin = actorCtx.self;
          const resolvedEvent: typeof _event = {
            ..._event,
            name:
              _event.name === actionTypes.error
                ? `${error(origin.id)}`
                : _event.name,
            origin: origin
          };
          target.send(resolvedEvent);
        });
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
      actorCtx.defer?.((state: AnyState) => {
        try {
          const currentRef = state.children[id];
          if (!currentRef) {
            return;
          }
          if (autoForward) {
            interpreter._forwardTo.add(currentRef);
          }

          currentRef.start?.();
        } catch (err) {
          interpreter.send(error(id, err));
          return;
        }
      });
    },
    [actionTypes.stop]: (_ctx, _e, { action }) => {
      const { actor } = (action as StopActionObject).params;

      if (actor) {
        actorCtx.defer?.(() => {
          actor.stop?.();
        });
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
  } as ActionFunctionMap<ContextFrom<TState>, EventFrom<TState>>)[actionType];
}
