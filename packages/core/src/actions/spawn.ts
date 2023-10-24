import isDevelopment from '#is-development';
import { cloneState } from '../State.ts';
import { createErrorActorEvent } from '../eventUtils.ts';
import { ActorStatus, createActor } from '../interpreter.ts';
import {
  ActionArgs,
  AnyActorContext,
  AnyActorRef,
  AnyActor,
  AnyState,
  EventObject,
  MachineContext,
  ParameterizedObject,
  AnyActorLogic,
  Snapshot,
  ProvidedActor
} from '../types.ts';
import { resolveReferencedActor } from '../utils.ts';

function resolveSpawn(
  actorContext: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any, any, any>,
  {
    id,
    systemId,
    src,
    input,
    syncSnapshot
  }: {
    id: string;
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

  let actorRef: AnyActorRef | undefined;

  if (referenced) {
    // TODO: inline `input: undefined` should win over the referenced one
    const configuredInput = input || referenced.input;
    actorRef = createActor(referenced.src, {
      id,
      src: typeof src === 'string' ? src : undefined,
      parent: actorContext?.self,
      systemId,
      input:
        typeof configuredInput === 'function'
          ? configuredInput({
              context: state.context,
              event: actionArgs.event,
              self: actorContext?.self
            })
          : configuredInput
    });

    if (syncSnapshot) {
      actorRef.subscribe({
        next: (snapshot: Snapshot<unknown>) => {
          if (snapshot.status === 'active') {
            actorContext.self.send({
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
      `Actor type '${src}' not found in machine '${actorContext.id}'.`
    );
  }
  return [
    cloneState(state, {
      children: {
        ...state.children,
        [id]: actorRef!
      }
    }),
    {
      id,
      actorRef
    }
  ];
}

function executeSpawn(
  actorContext: AnyActorContext,
  { id, actorRef }: { id: string; actorRef: AnyActorRef }
) {
  if (!actorRef) {
    return;
  }

  actorContext.defer(() => {
    if (actorRef.status === ActorStatus.Stopped) {
      return;
    }
    try {
      actorRef.start?.();
    } catch (err) {
      (actorContext.self as AnyActor).send(createErrorActorEvent(id, err));
      return;
    }
  });
}

export interface SpawnAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>): void;
  _out_TActor?: TActor;
}

export function spawn<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
>(
  src: string | AnyActorLogic,
  {
    id,
    systemId,
    input,
    syncSnapshot = false
  }: {
    id?: string | undefined;
    systemId?: string | undefined;
    input?: unknown;
    syncSnapshot?: boolean;
  } = {}
): SpawnAction<TContext, TExpressionEvent, TExpressionAction, TEvent, TActor> {
  function spawn(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
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
