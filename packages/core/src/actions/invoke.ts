import isDevelopment from '#is-development';
import { cloneState } from '../State.ts';
import { error } from '../actions.ts';
import { ActorStatus, interpret } from '../interpreter.ts';
import {
  ActionArgs,
  AnyActorContext,
  AnyActorRef,
  AnyInterpreter,
  AnyState,
  EventObject,
  MachineContext
} from '../types.ts';
import { resolveReferencedActor } from '../utils.ts';

function resolve(
  actorContext: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any>,
  {
    id,
    systemId,
    src,
    input
  }: {
    id: string;
    systemId: string | undefined;
    src: string;
    input?: unknown;
  }
) {
  const referenced = resolveReferencedActor(
    state.machine.implementations.actors[src]
  );

  let actorRef: AnyActorRef | undefined;

  if (referenced) {
    // TODO: inline `input: undefined` should win over the referenced one
    const configuredInput = input || referenced.input;
    actorRef = interpret(referenced.src, {
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
      (actorContext.self as AnyInterpreter).send(error(id, err));
      return;
    }
  });
}

export function invoke<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>({
  id,
  systemId,
  src,
  input
}: {
  id: string;
  systemId: string | undefined;
  src: string;
  input?: unknown;
}) {
  function invoke(_: ActionArgs<TContext, TExpressionEvent>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  invoke.type = 'xstate.invoke';
  invoke.id = id;
  invoke.systemId = systemId;
  invoke.src = src;
  invoke.input = input;

  invoke.resolve = resolve;
  invoke.execute = execute;

  return invoke;
}
