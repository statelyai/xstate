import { ProcessingStatus, createActor } from './createActor.ts';
import {
  ActorRefFrom,
  AnyActorLogic,
  AnyActorRef,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  ConditionalRequired,
  InputFrom,
  IsLiteralString,
  IsNotNever,
  ProvidedActor,
  RequiredActorOptions,
  TODO
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

// it's likely-ish that `(TActor & { src: TSrc })['logic']` would be faster
// but it's only possible to do it since https://github.com/microsoft/TypeScript/pull/53098 (TS 5.1)
// and we strive to support TS 5.0 whenever possible
type GetConcreteLogic<
  TActor extends ProvidedActor,
  TSrc extends TActor['src']
> = Extract<TActor, { src: TSrc }>['logic'];

export type Spawner<TActor extends ProvidedActor> = IsLiteralString<
  TActor['src']
> extends true
  ? {
      <TSrc extends TActor['src']>(
        logic: TSrc,
        ...[options]: SpawnOptions<TActor, TSrc>
      ): ActorRefFrom<GetConcreteLogic<TActor, TSrc>>;
      <TLogic extends AnyActorLogic>(
        src: TLogic,
        options?: {
          id?: never;
          systemId?: string;
          input?: InputFrom<TLogic>;
          syncSnapshot?: boolean;
        }
      ): ActorRefFrom<TLogic>;
    }
  : <TLogic extends AnyActorLogic | string>(
      src: TLogic,
      options?: {
        id?: string;
        systemId?: string;
        input?: TLogic extends string ? unknown : InputFrom<TLogic>;
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
        syncSnapshot: options.syncSnapshot,
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

      return actorRef;
    } else {
      const actorRef = createActor(src, {
        id: options.id,
        parent: actorScope.self,
        syncSnapshot: options.syncSnapshot,
        input: options.input,
        src,
        systemId
      });

      return actorRef;
    }
  };
  return (src, options) => {
    const actorRef = spawn(src, options);
    spawnedChildren[actorRef.id] = actorRef;
    actorScope.defer(() => {
      if (actorRef._processingStatus === ProcessingStatus.Stopped) {
        return;
      }
      actorRef.start();
    });
    return actorRef;
  };
}
