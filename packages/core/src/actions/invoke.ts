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
  Snapshot
} from '../types.ts';
import { resolveReferencedActor } from '../utils.ts';

function resolve(
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
    src: string;
    input?: unknown;
    syncSnapshot: boolean;
  }
) {
  const referenced = resolveReferencedActor(
    state.machine.implementations.actors[src]
  );

  let actorRef: AnyActorRef | undefined;

  if (referenced) {
    // TODO: inline `input: undefined` should win over the referenced one
    const configuredInput = input || referenced.input;
    actorRef = createActor(referenced.src, {
      id,
      src,
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
        error: () => {
          /* TODO */
        }
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

function execute(
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

// we don't export this since it's an internal action that is not meant to be used in the user's code
interface InvokeAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>): void;
}

export function invoke<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
>({
  id,
  systemId,
  src,
  input,
  onSnapshot
}: {
  id: string;
  systemId: string | undefined;
  src: string;
  input?: unknown;
  onSnapshot?: {}; // TODO: transition object
}): InvokeAction<TContext, TExpressionEvent, TExpressionAction, TEvent> {
  function invoke(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  invoke.type = 'xstate.invoke';
  invoke.id = id;
  invoke.systemId = systemId;
  invoke.src = src;
  invoke.input = input;
  invoke.syncSnapshot = !!onSnapshot;

  invoke.resolve = resolve;
  invoke.execute = execute;

  return invoke;
}
