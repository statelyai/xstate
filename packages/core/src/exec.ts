import {
  InvokeActionObject,
  BaseActionObject,
  AnyState,
  ActorContext,
  AnyInterpreter,
  EventObject,
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
  ActorRef
} from '.';
import { isExecutableAction } from '../actions/ExecutableAction';
import { actionTypes, error } from './actions';
import { IS_PRODUCTION } from './environment';
import { isFunction, warn } from './utils';

export function execAction(
  action: InvokeActionObject | BaseActionObject,
  state: AnyState,
  actorContext: ActorContext<any, any>
): void {
  const interpreter = actorContext.self as AnyInterpreter;

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
        execSendTo(sendAction.params._event, target, actorCtx);
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
      actorCtx.defer?.((state2) => {
        try {
          if (autoForward) {
            interpreter._forwardTo.add(id);
          }

          state2.children[id]?.start?.();
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
        delete state.children[actor.id];
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

function execSendTo(
  event: SCXML.Event<AnyEventObject>,
  destination: ActorRef<any>,
  actorContext: ActorContext<any, any>
) {
  const origin = actorContext.self;
  const resolvedEvent: typeof event = {
    ...event,
    name: event.name === actionTypes.error ? `${error(origin.id)}` : event.name,
    origin: origin
  };

  actorContext.defer?.(() => {
    destination.send(resolvedEvent);
  });
}
