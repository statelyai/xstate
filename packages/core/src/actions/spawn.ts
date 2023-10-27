import isDevelopment from '#is-development';
import { cloneState } from '../State.ts';
import { createErrorActorEvent } from '../eventUtils.ts';
import { ActorStatus, createActor } from '../interpreter.ts';
import {
  ActionArgs,
  AnyActorScope,
  AnyActorRef,
  AnyActor,
  AnyState,
  EventObject,
  MachineContext,
  ParameterizedObject,
  AnyActorLogic,
  Snapshot,
  ProvidedActor,
  IsLiteralString,
  InputFrom,
  UnifiedArg
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
  state: AnyState,
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
  const referenced =
    typeof src === 'string'
      ? resolveReferencedActor(state.machine, src)
      : { src, input: undefined };
  const resolvedId = typeof id === 'function' ? id(actionArgs) : id;

  let actorRef: AnyActorRef | undefined;

  if (referenced) {
    // TODO: inline `input: undefined` should win over the referenced one
    const configuredInput = input || referenced.input;
    actorRef = createActor(referenced.src, {
      id: resolvedId,
      src: typeof src === 'string' ? src : undefined,
      parent: actorScope?.self,
      systemId,
      input:
        typeof configuredInput === 'function'
          ? configuredInput({
              context: state.context,
              event: actionArgs.event,
              self: actorScope?.self
            })
          : configuredInput
    });

    if (syncSnapshot) {
      actorRef.subscribe({
        next: (snapshot: Snapshot<unknown>) => {
          if (snapshot.status === 'active') {
            actorScope.self.send({
              type: `xstate.snapshot.${id}`,
              snapshot
            });
          }
        },
        error: () => {}
      });
    }
  }

  if (isDevelopment && !actorRef) {
    console.warn(
      `Actor type '${src}' not found in machine '${actorScope.id}'.`
    );
  }
  return [
    cloneState(state, {
      children: {
        ...state.children,
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
    if (actorRef.status === ActorStatus.Stopped) {
      return;
    }
    try {
      actorRef.start?.();
    } catch (err) {
      (actorScope.self as AnyActor).send(createErrorActorEvent(id, err));
      return;
    }
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

type DistributeActors<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> = TActor extends any
  ? 'id' extends keyof TActor
    ? [
        src: TActor['src'],
        options: {
          id: ResolvableActorId<
            TContext,
            TExpressionEvent,
            TEvent,
            TActor['id']
          >;
          systemId?: string;
          input?: InputFrom<TActor['logic']>;
          syncSnapshot?: boolean;
        }
      ]
    : [
        src: TActor['src'],
        options?: {
          id?: ResolvableActorId<TContext, TExpressionEvent, TEvent, string>;
          systemId?: string;
          input?: InputFrom<TActor['logic']>;
          syncSnapshot?: boolean;
        }
      ]
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

export function spawn<
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
  function spawn(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  spawn.type = 'xstate.spawn';
  spawn.id = id;
  spawn.systemId = systemId;
  spawn.src = src;
  spawn.input = input;
  spawn.syncSnapshot = syncSnapshot;

  spawn.resolve = resolveSpawn;
  spawn.execute = executeSpawn;

  return spawn;
}
