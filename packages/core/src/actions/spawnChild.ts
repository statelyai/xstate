import isDevelopment from '#is-development';
import { cloneMachineSnapshot } from '../State.ts';
import { createErrorActorEvent } from '../eventUtils.ts';
import { ProcessingStatus, createActor } from '../interpreter.ts';
import {
  ActionArgs,
  AnyActorScope,
  AnyActorRef,
  AnyActor,
  AnyMachineSnapshot,
  EventObject,
  MachineContext,
  ParameterizedObject,
  AnyActorLogic,
  ProvidedActor,
  IsLiteralString,
  InputFrom,
  UnifiedArg,
  Mapper,
  RequiredActorOptions,
  ConditionalRequired,
  IsNotNever
} from '../types.ts';
import { resolveReferencedActor } from '../utils.ts';

type ResolvableActorId<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TId extends string | undefined
> = TId | ((args: UnifiedArg<TContext, TExpressionEvent, TEvent>) => TId);

function resolveSpawn(
  actorScope: AnyActorScope,
  snapshot: AnyMachineSnapshot,
  actionArgs: ActionArgs<any, any, any>,
  _actionParams: ParameterizedObject['params'] | undefined,
  {
    id,
    systemId,
    src,
    input,
    syncSnapshot
  }: {
    id: ResolvableActorId<MachineContext, EventObject, EventObject, string>;
    systemId: string | undefined;
    src: AnyActorLogic | string;
    input?: unknown;
    syncSnapshot: boolean;
  }
) {
  const logic =
    typeof src === 'string'
      ? resolveReferencedActor(snapshot.machine, src)
      : src;
  const resolvedId = typeof id === 'function' ? id(actionArgs) : id;

  let actorRef: AnyActorRef | undefined;

  if (logic) {
    actorRef = createActor(logic, {
      id: resolvedId,
      src,
      parent: actorScope?.self,
      syncSnapshot,
      systemId,
      input:
        typeof input === 'function'
          ? input({
              context: snapshot.context,
              event: actionArgs.event,
              self: actorScope?.self
            })
          : input
    });
  }

  if (isDevelopment && !actorRef) {
    console.warn(
      `Actor type '${src}' not found in machine '${actorScope.id}'.`
    );
  }
  return [
    cloneMachineSnapshot(snapshot, {
      children: {
        ...snapshot.children,
        [resolvedId]: actorRef!
      }
    }),
    {
      id,
      actorRef
    }
  ];
}

function executeSpawn(
  actorScope: AnyActorScope,
  { id, actorRef }: { id: string; actorRef: AnyActorRef }
) {
  if (!actorRef) {
    return;
  }

  actorScope.defer(() => {
    if (actorRef._processingStatus === ProcessingStatus.Stopped) {
      return;
    }
    actorRef.start();
  });
}

export interface SpawnAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
  _out_TActor?: TActor;
}

interface SpawnActionOptions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> {
  id?: ResolvableActorId<TContext, TExpressionEvent, TEvent, TActor['id']>;
  systemId?: string;
  input?:
    | Mapper<TContext, TEvent, InputFrom<TActor['logic']>, TEvent>
    | InputFrom<TActor['logic']>;
  syncSnapshot?: boolean;
}

type DistributeActors<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> = TActor extends any
  ? ConditionalRequired<
      [
        src: TActor['src'],
        options?: SpawnActionOptions<
          TContext,
          TExpressionEvent,
          TEvent,
          TActor
        > & {
          [K in RequiredActorOptions<TActor>]: unknown;
        }
      ],
      IsNotNever<RequiredActorOptions<TActor>>
    >
  : never;

type SpawnArguments<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> = IsLiteralString<TActor['src']> extends true
  ? DistributeActors<TContext, TExpressionEvent, TEvent, TActor>
  : [
      src: string | AnyActorLogic,
      options?: {
        id?: ResolvableActorId<TContext, TExpressionEvent, TEvent, string>;
        systemId?: string;
        input?: unknown;
        syncSnapshot?: boolean;
      }
    ];

export function spawnChild<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
>(
  ...[
    src,
    { id, systemId, input, syncSnapshot = false } = {} as any
  ]: SpawnArguments<TContext, TExpressionEvent, TEvent, TActor>
): SpawnAction<TContext, TExpressionEvent, TParams, TEvent, TActor> {
  function spawnChild(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  spawnChild.type = 'snapshot.spawnChild';
  spawnChild.id = id;
  spawnChild.systemId = systemId;
  spawnChild.src = src;
  spawnChild.input = input;
  spawnChild.syncSnapshot = syncSnapshot;

  spawnChild.resolve = resolveSpawn;
  spawnChild.execute = executeSpawn;

  return spawnChild;
}
