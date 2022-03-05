import {
  MachineContext,
  EventObject,
  StateMachine,
  SCXML,
  InvokeActionObject,
  Behavior,
  ActorRef,
  ActionTypes
} from '.';
import { ObservableActorRef } from './ObservableActorRef';
import { isString } from './utils';

export function createSpawner<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  machine: StateMachine<any, any>,
  context: TContext,
  _event: SCXML.Event<TEvent>,
  mutCapturedActions: InvokeActionObject[]
): <TReceived extends EventObject, TEmitted>(
  behavior: string | Behavior<TReceived, TEmitted>,
  name?: string | undefined
) => ActorRef<TReceived, TEmitted> {
  return (behavior, name) => {
    if (isString(behavior)) {
      const behaviorCreator = machine.options.actors[behavior];

      if (behaviorCreator) {
        const resolvedName = name ?? 'anon'; // TODO: better name
        const createdBehavior = behaviorCreator(context, _event.data, {
          id: name || 'anon',
          src: { type: behavior },
          _event,
          meta: undefined
        });

        const actorRef = new ObservableActorRef(createdBehavior, resolvedName);

        mutCapturedActions.push({
          type: ActionTypes.Invoke,
          params: {
            src: actorRef,
            ref: actorRef,
            id: actorRef.name,
            meta: undefined
          }
        });

        return actorRef;
      }

      throw new Error('does not exist');
    } else {
      const actorRef = new ObservableActorRef(behavior, name || 'anonymous');

      mutCapturedActions.push({
        type: ActionTypes.Invoke,
        params: {
          src: actorRef,
          ref: actorRef,
          id: actorRef.name,
          meta: undefined
        }
      });

      return actorRef;
    }
  };
}
