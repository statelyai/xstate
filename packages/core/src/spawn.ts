import { InvokeActionObject, AnyStateMachine, Spawner, ActorRef } from '.';
import { invoke } from './actions/invoke.js';
import { interpret } from './interpreter.js';
import { isString } from './utils.js';

export function createSpawner(
  self: ActorRef<any, any> | undefined,
  machine: AnyStateMachine,
  mutCapturedActions: InvokeActionObject[]
): Spawner {
  return (behavior, { id, input } = {}) => {
    if (isString(behavior)) {
      const behaviorCreator = machine.options.actors[behavior];

      if (behaviorCreator) {
        const resolvedName = id ?? 'anon'; // TODO: better name
        const createdBehavior = behaviorCreator;

        // TODO: this should also receive `src`
        const actorRef = interpret(createdBehavior, {
          id: resolvedName,
          parent: self,
          input
        });

        mutCapturedActions.push(
          invoke({
            id: actorRef.id,
            // @ts-ignore TODO: fix types
            src: actorRef, // TODO
            ref: actorRef,
            meta: undefined,
            input
          }) as any as InvokeActionObject
        );

        return actorRef as any; // TODO: fix types
      }

      throw new Error(
        `Behavior '${behavior}' not implemented in machine '${machine.id}'`
      );
    } else {
      // TODO: this should also receive `src`
      // TODO: instead of anonymous, it should be a unique stable ID
      const actorRef = interpret(behavior, {
        id: id || 'anonymous',
        parent: self,
        input
      });

      mutCapturedActions.push(
        invoke({
          // @ts-ignore TODO: fix types
          src: actorRef,
          ref: actorRef,
          id: actorRef.id,
          meta: undefined,
          input
        }) as any as InvokeActionObject
      );

      return actorRef as any; // TODO: fix types
    }
  };
}
