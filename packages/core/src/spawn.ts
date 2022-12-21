import {
  MachineContext,
  EventObject,
  SCXML,
  InvokeActionObject,
  ActionTypes,
  AnyStateMachine,
  Spawner
} from '.';
import { interpret } from './interpreter';
import { isString } from './utils';

export function createSpawner<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  machine: AnyStateMachine,
  context: TContext,
  _event: SCXML.Event<TEvent>,
  mutCapturedActions: InvokeActionObject[]
): Spawner {
  return (behavior, name) => {
    if (isString(behavior)) {
      const behaviorCreator = machine.options.actors[behavior];

      if (behaviorCreator) {
        const resolvedName = name ?? 'anon'; // TODO: better name
        const createdBehavior =
          typeof behaviorCreator === 'function'
            ? behaviorCreator(context, _event.data, {
                id: resolvedName,
                src: { type: behavior },
                _event,
                meta: undefined
              })
            : behaviorCreator;

        const actorRef = interpret(createdBehavior, { id: resolvedName });

        mutCapturedActions.push({
          type: ActionTypes.Invoke,
          params: {
            src: actorRef,
            ref: actorRef,
            id: actorRef.id,
            meta: undefined
          }
        });

        return actorRef as any; // TODO: fix types
      }

      throw new Error(
        `Behavior '${behavior}' not implemented in machine '${machine.id}'`
      );
    } else {
      const actorRef = interpret(behavior, { id: name || 'anonymous' });

      mutCapturedActions.push({
        type: ActionTypes.Invoke,
        params: {
          src: actorRef,
          ref: actorRef,
          id: actorRef.id,
          meta: undefined
        }
      });

      return actorRef as any; // TODO: fix types
    }
  };
}
