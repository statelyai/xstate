import {
  allocateChildId,
  registerSpawnedChild,
  reserveChildId
} from './transitionActions.ts';
import {
  ActorFromLogic,
  AnyActorLogic,
  AnyActorRef,
  AnyActorScope,
  ConditionalRequired,
  InputFrom,
  IsNotNever,
  RegistryKeyForLogic,
  SystemRegistry,
  type RequiredLogicInput
} from './types.ts';

export type Spawner<TSystemRegistry extends SystemRegistry = SystemRegistry> = <
  TLogic extends AnyActorLogic
>(
  src: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: {
        id?: string;
        registryKey?: RegistryKeyForLogic<TLogic, TSystemRegistry>;
        input?: InputFrom<TLogic>;
        syncSnapshot?: boolean;
      } & { [K in RequiredLogicInput<TLogic>]: unknown }
    ],
    IsNotNever<RequiredLogicInput<TLogic>>
  >
) => ActorFromLogic<TLogic>;

export function createSpawner(
  actorScope: AnyActorScope,
  actors: Record<string, AnyActorLogic>,
  spawnedChildren: Record<string, AnyActorRef>
): Spawner {
  return ((src, options) => {
    const referencedSrc = Object.entries(actors).find(
      ([, logic]) => logic === src
    )?.[0];
    // Generated ids come from the same transaction allocator as `enq.spawn`,
    // so context-factory allocations persist with the snapshot and never
    // collide with later spawns.
    const id =
      options?.id ?? allocateChildId(actorScope, referencedSrc ?? src).id;
    if (options?.id !== undefined) {
      reserveChildId(actorScope, options.id);
    }
    const actor = actorScope.system.createActorRef(src, {
      id,
      parent: actorScope.self,
      syncSnapshot: options?.syncSnapshot,
      input: options?.input,
      src: referencedSrc ?? src,
      registryKey: options?.registryKey
    });
    spawnedChildren[actor.id] = actor;
    registerSpawnedChild(actorScope, actor.id, actor);
    return actor;
  }) as Spawner;
}
