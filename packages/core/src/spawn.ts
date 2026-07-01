import { ProcessingStatus, createActor } from './createActor.ts';
import {
  ActorFromLogic,
  AnyActorLogic,
  AnyActorRef,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  ConditionalRequired,
  InputFrom,
  IsNotNever,
  RegistryKeyForLogic,
  SystemRegistry,
  TODO,
  type RequiredLogicInput
} from './types.ts';
import { resolveReferencedActor } from './utils.ts';

export type Spawner<TSystemRegistry extends SystemRegistry = SystemRegistry> = <
  TLogic extends AnyActorLogic
>(
  src: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: {
        id?: string;
        registryKey?: RegistryKeyForLogic<TLogic, TSystemRegistry>;
        input?: TLogic extends string ? unknown : InputFrom<TLogic>;
        syncSnapshot?: boolean;
      } & { [K in RequiredLogicInput<TLogic>]: unknown }
    ],
    IsNotNever<RequiredLogicInput<TLogic>>
  >
) => ActorFromLogic<TLogic>;

export function createSpawner(
  actorScope: AnyActorScope,
  { machine, context }: AnyMachineSnapshot,
  event: AnyEventObject,
  spawnedChildren: Record<string, AnyActorRef>
): Spawner {
  const spawn: Spawner = ((src, options) => {
    if (typeof src === 'string') {
      const logic = resolveReferencedActor(machine, src);

      if (!logic) {
        throw new Error(
          `Actor logic '${src as string}' not implemented in machine '${machine.id}'`
        );
      }

      const actor = createActor(logic, {
        id: options?.id,
        parent: actorScope.self,
        syncSnapshot: options?.syncSnapshot,
        input:
          typeof options?.input === 'function'
            ? options.input({
                context,
                event,
                self: actorScope.self
              })
            : options?.input,
        src,
        registryKey: options?.registryKey
      }) as any;

      spawnedChildren[actor.id] = actor;

      return actor;
    } else {
      const actor = createActor(src, {
        id: options?.id,
        parent: actorScope.self,
        syncSnapshot: options?.syncSnapshot,
        input: options?.input,
        src,
        registryKey: options?.registryKey
      });

      return actor;
    }
  }) as Spawner;
  return ((src, options) => {
    const actor = spawn(src, options) as TODO; // TODO: fix types
    spawnedChildren[actor.id] = actor;
    actorScope.defer(() => {
      if (actor._processingStatus === ProcessingStatus.Stopped) {
        return;
      }
      actor.start();
    });
    return actor;
  }) as Spawner;
}
