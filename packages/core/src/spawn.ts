import { createErrorActorEvent } from './eventUtils.ts';
import { ProcessingStatus, createActor } from './interpreter.ts';
import {
  ActorRefFrom,
  AnyActorScope,
  AnyActorLogic,
  AnyActorRef,
  AnyEventObject,
  AnyMachineSnapshot,
  InputFrom,
  IsLiteralString,
  ProvidedActor,
  Snapshot,
  TODO,
  RequiredActorOptions,
  IsNotNever,
  ConditionalRequired
} from './types.ts';
import { resolveReferencedActor } from './utils.ts';

type SpawnOptions<
  TActor extends ProvidedActor,
  TSrc extends TActor['src']
> = TActor extends {
  src: TSrc;
}
  ? ConditionalRequired<
      [
        options?: {
          id?: TActor['id'];
          systemId?: string;
          input?: InputFrom<TActor['logic']>;
          syncSnapshot?: boolean;
        } & { [K in RequiredActorOptions<TActor>]: unknown }
      ],
      IsNotNever<RequiredActorOptions<TActor>>
    >
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
  { machine, context }: AnyMachineSnapshot,
  event: AnyEventObject,
  spawnedChildren: Record<string, AnyActorRef>
): Spawner<any> {
  const spawn: Spawner<any> = (src, options = {}) => {
    const { systemId, input } = options;
    if (typeof src === 'string') {
      const logic = resolveReferencedActor(machine, src);

      if (!logic) {
        throw new Error(
          `Actor logic '${src}' not implemented in machine '${machine.id}'`
        );
      }

      const actorRef = createActor(logic, {
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
