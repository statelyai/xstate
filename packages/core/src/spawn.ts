import { InvokeActionObject, AnyStateMachine, Spawner, ActorRef } from '.';
import { invoke } from './actions/invoke.js';
import { interpret } from './interpreter.js';
import { isString } from './utils.js';

export function createSpawner(
  self: ActorRef<any, any> | undefined,
  machine: AnyStateMachine,
  mutCapturedActions: InvokeActionObject[]
): Spawner {
  return (src, { id, input } = {}) => {
    if (isString(src)) {
      const behavior = machine.options.actors[src];

      if (behavior) {
        const resolvedName = id ?? 'anon'; // TODO: better name

        // TODO: this should also receive `src`
        const actorRef = interpret(behavior, {
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
        `Behavior '${src}' not implemented in machine '${machine.id}'`
      );
    } else {
      // TODO: this should also receive `src`
      // TODO: instead of anonymous, it should be a unique stable ID
      const actorRef = interpret(src, {
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
