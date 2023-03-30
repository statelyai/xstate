import {
  InvokeActionObject,
  AnyStateMachine,
  Spawner,
  ActorRef,
  MachineContext,
  EventObject,
  SCXML
} from '.';
import { invoke } from './actions/invoke.js';
import { interpret } from './interpreter.js';
import { isString, resolveReferencedActor } from './utils.js';

export function createSpawner<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  self: ActorRef<any, any> | undefined,
  machine: AnyStateMachine,
  context: TContext,
  _event: SCXML.Event<TEvent>,
  mutCapturedActions: InvokeActionObject[]
): Spawner {
  return (src, options = {}) => {
    if (isString(src)) {
      const referenced = resolveReferencedActor(machine.options.actors[src]);

      if (referenced) {
        const resolvedName = options.id ?? 'anon'; // TODO: better name
        const input = 'input' in options ? options.input : referenced.input;

        // TODO: this should also receive `src`
        const actorRef = interpret(referenced.src, {
          id: resolvedName,
          parent: self,
          input:
            typeof input === 'function'
              ? input(context, _event.data, {
                  self
                })
              : input
        });

        mutCapturedActions.push(
          invoke({
            id: actorRef.id,
            // @ts-ignore TODO: fix types
            src: actorRef, // TODO
            ref: actorRef,
            meta: undefined,
            input
          }) as any as InvokeActionObject
        );

        return actorRef as any; // TODO: fix types
      }

      throw new Error(
        `Behavior '${src}' not implemented in machine '${machine.id}'`
      );
    } else {
      // TODO: this should also receive `src`
      // TODO: instead of anonymous, it should be a unique stable ID
      const actorRef = interpret(src, {
        id: options.id || 'anonymous',
        parent: self,
        input: options.input
      });

      mutCapturedActions.push(
        invoke({
          // @ts-ignore TODO: fix types
          src: actorRef,
          ref: actorRef,
          id: actorRef.id,
          meta: undefined,
          input: options.input
        }) as any as InvokeActionObject
      );

      return actorRef as any; // TODO: fix types
    }
  };
}
