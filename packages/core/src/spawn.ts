import { createErrorActorEvent } from './eventUtils.ts';
import { ProcessingStatus, createActor } from './interpreter.ts';
import {
  ActorRefFrom,
  AnyActorScope,
  AnyActorLogic,
  AnyActorRef,
  AnyEventObject,
  AnyState,
  InputFrom,
  IsLiteralString,
  ProvidedActor,
  Snapshot,
  TODO
} from './types.ts';
import { resolveReferencedActor } from './utils.ts';

export type SpawnOptions<
  TActor extends ProvidedActor,
  TSrc extends TActor['src']
> = TActor extends {
  src: TSrc;
}
  ? 'id' extends keyof TActor
    ? [
        options: {
          id: TActor['id'];
          systemId?: string;
          input?: InputFrom<TActor['logic']>;
          syncSnapshot?: boolean;
        }
      ]
    : [
        options?: {
          id?: string;
          systemId?: string;
          input?: InputFrom<TActor['logic']>;
          syncSnapshot?: boolean;
        }
      ]
  : never;

export type Spawner<TActor extends ProvidedActor> = IsLiteralString<
  TActor['src']
> extends true
  ? <TSrc extends TActor['src']>(
      logic: TSrc,
      ...[options = {} as any]: SpawnOptions<TActor, TSrc>
    ) => ActorRefFrom<(TActor & { src: TSrc })['logic']>
  : // TODO: do not accept machines without all implementations
    <TLogic extends AnyActorLogic | string>(
      src: TLogic,
      options?: {
        id?: string;
        systemId?: string;
        input?: unknown;
        syncSnapshot?: boolean;
      }
    ) => TLogic extends string ? AnyActorRef : ActorRefFrom<TLogic>;

export function createSpawner(
  actorScope: AnyActorScope,
  { machine, context }: AnyState,
  event: AnyEventObject,
  spawnedChildren: Record<string, AnyActorRef>
): Spawner<any> {
  const spawn: Spawner<any> = (src, options = {}) => {
    const { systemId } = options;
    if (typeof src === 'string') {
      const referenced = resolveReferencedActor(machine, src);

      if (!referenced) {
        throw new Error(
          `Actor logic '${src}' not implemented in machine '${machine.id}'`
        );
      }

      const input = 'input' in options ? options.input : referenced.input;

      // TODO: this should also receive `src`
      const actorRef = createActor(referenced.src, {
        id: options.id,
        parent: actorScope.self,
        input:
          typeof input === 'function'
            ? input({
                context,
                event,
                self: actorScope.self
              })
            : input,
        src,
        systemId
      }) as any;
      spawnedChildren[actorRef.id] = actorRef;

      if (options.syncSnapshot) {
        actorRef.subscribe({
          next: (snapshot: Snapshot<unknown>) => {
            if (snapshot.status === 'active') {
              actorScope.self.send({
                type: `xstate.snapshot.${actorRef.id}`,
                snapshot
              });
            }
          },
          error: () => {}
        });
      }
      return actorRef;
    } else {
      const actorRef = createActor(src, {
        id: options.id,
        parent: actorScope.self,
        input: options.input,
        src,
        systemId
      });

      if (options.syncSnapshot) {
        actorRef.subscribe({
          next: (snapshot: Snapshot<unknown>) => {
            if (snapshot.status === 'active') {
              actorScope.self.send({
                type: `xstate.snapshot.${actorRef.id}`,
                snapshot,
                id: actorRef.id
              });
            }
          },
          error: () => {}
        });
      }

      return actorRef;
    }
  };
  return (src, options) => {
    const actorRef = spawn(src, options) as TODO; // TODO: fix types
    spawnedChildren[actorRef.id] = actorRef;
    actorScope.defer(() => {
      if (actorRef._processingStatus === ProcessingStatus.Stopped) {
        return;
      }
      try {
        actorRef.start?.();
      } catch (err) {
        actorScope.self.send(createErrorActorEvent(actorRef.id, err));
        return;
      }
    });
    return actorRef;
  };
}
