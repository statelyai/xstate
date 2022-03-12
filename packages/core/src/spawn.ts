import {
  MachineContext,
  EventObject,
  SCXML,
  InvokeActionObject,
  ActionTypes,
  AnyStateMachine,
  Spawner
} from '.';
import { createMachineBehavior, createPromiseBehavior } from './behaviors';
import { ObservableActorRef } from './ObservableActorRef';
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
  const spawner = (behavior, name) => {
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

        return actorRef as any; // TODO: fix types
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

      return actorRef as any; // TODO: fix types
    }
  };

  (spawner as Spawner).machine = (machine, options) => {
    const behavior = createMachineBehavior(machine, options);
    return spawner(behavior, options?.name);
  };

  (spawner as Spawner).promise = (lazyPromise, options) => {
    const behavior = createPromiseBehavior(lazyPromise);
    return spawner(behavior, options?.name);
  };

  return spawner as Spawner;
}
