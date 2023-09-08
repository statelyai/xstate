import { createErrorPlatformEvent } from './eventUtils.ts';
import { ActorStatus, createActor } from './interpreter.ts';
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
      const actor = createActor(referenced.src, {
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
      spawnedChildren[actor.id] = actor;
      return actor;
    } else {
      // TODO: this should also receive `src`
      return createActor(src, {
        id: options.id,
        parent: actorContext.self,
        input: options.input,
        systemId
      });
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
        actorContext.self.send(createErrorPlatformEvent(actorRef.id, err));
        return;
      }
    });
    return actorRef;
  };
}
