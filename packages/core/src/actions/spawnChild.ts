import isDevelopment from '#is-development';
import { cloneMachineSnapshot } from '../State.ts';
import { ProcessingStatus, createActor } from '../createActor.ts';
import { executingCustomAction } from '../stateUtils.ts';
import {
  ActionArgs,
  ActionFunction,
  AnyActorLogic,
  AnyActorRef,
  AnyActorScope,
  AnyMachineSnapshot,
  ConditionalRequired,
  EventObject,
  InputFrom,
  IsLiteralString,
  IsNotNever,
  MachineContext,
  Mapper,
  ParameterizedObject,
  ProvidedActor,
  RequiredActorOptions,
  TODO,
  UnifiedArg
} from '../types.ts';
import { resolveReferencedActor } from '../utils.ts';

type ResolvableActorId<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TId extends string | undefined,
  TEmitted extends EventObject
> =
  | TId
  | ((args: UnifiedArg<TContext, TExpressionEvent, TEvent, TEmitted>) => TId);

function resolveSpawn(
  actorScope: AnyActorScope,
  snapshot: AnyMachineSnapshot,
  actionArgs: ActionArgs<any, any, any, any>,
  _actionParams: ParameterizedObject['params'] | undefined,
  {
    id,
    systemId,
    src,
    input,
    syncSnapshot
  }: {
    id: ResolvableActorId<
      MachineContext,
      EventObject,
      EventObject,
      string,
      TODO
    >;
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
      parent: actorScope.self,
      syncSnapshot,
      systemId,
      input:
        typeof input === 'function'
          ? input({
              context: snapshot.context,
              event: actionArgs.event,
              self: actorScope.self
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
  TActor extends ProvidedActor,
  TEmitted extends EventObject
> {
  (
    args: ActionArgs<TContext, TExpressionEvent, TEvent, TEmitted>,
    params: TParams
  ): void;
  _out_TActor?: TActor;
  _out_TEmitted?: TEmitted;
}

interface SpawnActionOptions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TEmitted extends EventObject
> {
  id?: ResolvableActorId<
    TContext,
    TExpressionEvent,
    TEvent,
    TActor['id'],
    TEmitted
  >;
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
  TActor extends ProvidedActor,
  TEmitted extends EventObject
> =
  | (TActor extends any
      ? ConditionalRequired<
          [
            src: TActor['src'],
            options?: SpawnActionOptions<
              TContext,
              TExpressionEvent,
              TEvent,
              TActor,
              TEmitted
            > & {
              [K in RequiredActorOptions<TActor>]: unknown;
            }
          ],
          IsNotNever<RequiredActorOptions<TActor>>
        >
      : never)
  | [
      src: AnyActorLogic,
      options?: SpawnActionOptions<
        TContext,
        TExpressionEvent,
        TEvent,
        ProvidedActor,
        TEmitted
      > & { id?: never }
    ];

type SpawnArguments<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TEmitted extends EventObject
> = IsLiteralString<TActor['src']> extends true
  ? DistributeActors<TContext, TExpressionEvent, TEvent, TActor, TEmitted>
  : [
      src: string | AnyActorLogic,
      options?: {
        id?: ResolvableActorId<
          TContext,
          TExpressionEvent,
          TEvent,
          string,
          TEmitted
        >;
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
  TActor extends ProvidedActor,
  TEmitted extends EventObject
>(
  ...[
    src,
    { id, systemId, input, syncSnapshot = false } = {} as any
  ]: SpawnArguments<TContext, TExpressionEvent, TEvent, TActor, TEmitted>
): ActionFunction<
  TContext,
  TExpressionEvent,
  TEvent,
  TParams,
  TActor,
  never,
  never,
  never,
  TEmitted
> {
  function spawnChild(
    args: ActionArgs<TContext, TExpressionEvent, TEvent, TEmitted>,
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
