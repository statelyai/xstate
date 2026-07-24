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
  actorSources: Record<string, AnyActorLogic>,
  spawnedChildren: Record<string, AnyActorRef>
): Spawner {
  return ((src, options) => {
    const referencedSrc = Object.entries(actorSources).find(
      ([, logic]) => logic === src
    )?.[0];
    const actor = actorScope.system.createActorRef(src, {
      id: options?.id,
      parent: actorScope.self,
      syncSnapshot: options?.syncSnapshot,
      input: options?.input,
      src: referencedSrc ?? src,
      registryKey: options?.registryKey
    });
    spawnedChildren[actor.id] = actor;
    return actor;
  }) as Spawner;
}
