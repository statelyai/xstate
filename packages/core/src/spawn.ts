import { error } from './actions.ts';
import { ActorStatus, interpret } from './interpreter.ts';
import {
  AnyActorContext,
  AnyActorRef,
  AnyEventObject,
  AnyState,
  Spawner,
  TODO
} from './types.ts';
import { resolveReferencedActor } from './utils.ts';

export function createSpawner(
  actorContext: AnyActorContext,
  { machine, context }: AnyState,
  event: AnyEventObject,
  spawnedChildren: Record<string, AnyActorRef>
): Spawner {
  const spawn: Spawner = (src, options = {}) => {
    const { systemId } = options;
    if (typeof src === 'string') {
      const referenced = resolveReferencedActor(
        machine.implementations.actors[src]
      );

      if (!referenced) {
        throw new Error(
          `Actor logic '${src}' not implemented in machine '${machine.id}'`
        );
      }

      const input = 'input' in options ? options.input : referenced.input;

      // TODO: this should also receive `src`
      const actorRef = interpret(referenced.src, {
        id: options.id,
        parent: actorContext.self,
        input:
          typeof input === 'function'
            ? input({
                context,
                event,
                self: actorContext.self
              })
            : input,
        systemId
      }) as any;
      spawnedChildren[actorRef.id] = actorRef;

      // if (options.subscribe) {
      actorRef.subscribe((snapshot: unknown) => {
        actorContext.self.send({
          type: `xstate.snapshot.${actorRef.id}`,
          snapshot,
          id: actorRef.id
        });
      });
      // }
      return actorRef;
    } else {
      // TODO: this should also receive `src`
      const actorRef = interpret(src, {
        id: options.id,
        parent: actorContext.self,
        input: options.input,
        systemId
      });

      // if (options.subscribe) {
      actorRef.subscribe((snapshot) => {
        actorContext.self.send({
          type: `xstate.snapshot.${actorRef.id}`,
          snapshot,
          id: actorRef.id
        });
      });
      // }

      return actorRef;
    }
  };
  return (src, options) => {
    const actorRef = spawn(src, options) as TODO; // TODO: fix types
    spawnedChildren[actorRef.id] = actorRef;
    actorContext.defer(() => {
      if (actorRef.status === ActorStatus.Stopped) {
        return;
      }
      try {
        actorRef.start?.();
      } catch (err) {
        actorContext.self.send(error(actorRef.id, err));
        return;
      }
    });
    return actorRef;
  };
}
