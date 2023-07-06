import isDevelopment from '#is-development';
import { EventObject, InvokeDefinition, MachineContext } from '../types.ts';
import {
  AnyActorContext,
  AnyActorRef,
  AnyInterpreter,
  AnyState,
  UnifiedArg
} from '../index.ts';
import { error } from '../actions.ts';
import { resolveReferencedActor } from '../utils.ts';
import { ActorStatus, interpret } from '../interpreter.ts';
import { cloneState } from '../State.ts';
import { BuiltinAction } from './_shared.ts';

class InvokeResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static id: string;
  static systemId: string | undefined;
  static src: string;
  static input: any;

  static resolve(
    actorContext: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    const { id, systemId, src, input } = this;

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
                event: args.event,
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

  static execute(
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
}

export function invoke<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>({ id, systemId, src, input }: InvokeDefinition<TContext, TEvent>) {
  return class Invoke extends InvokeResolver<
    TContext,
    TExpressionEvent,
    TEvent
  > {
    static id = id;
    static systemId = systemId;
    static src = src;
    static input = input;
  };
}
