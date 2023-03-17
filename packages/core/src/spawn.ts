import {
  MachineContext,
  EventObject,
  SCXML,
  InvokeActionObject,
  AnyStateMachine,
  Spawner,
  ActorRef
} from '.';
import { invoke } from './actions/invoke.js';
import { interpret } from './interpreter.js';
import { isString } from './utils.js';

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
  return (behavior, name) => {
    if (isString(behavior)) {
      const behaviorCreator = machine.options.actors[behavior];

      if (behaviorCreator) {
        const resolvedName = name ?? 'anon'; // TODO: better name
        const createdBehavior =
          typeof behaviorCreator === 'function'
            ? behaviorCreator(context, _event.data, {
                id: resolvedName,
                src: { type: behavior },
                _event,
                meta: undefined
              })
            : behaviorCreator;

        // TODO: this should also receive `src`
        const actorRef = interpret(createdBehavior, {
          id: resolvedName,
          parent: self
        });

        mutCapturedActions.push(
          invoke({
            id: actorRef.id,
            // @ts-ignore TODO: fix types
            src: actorRef, // TODO
            ref: actorRef,
            meta: undefined
          }) as any as InvokeActionObject
        );

        return actorRef as any; // TODO: fix types
      }

      throw new Error(
        `Behavior '${behavior}' not implemented in machine '${machine.id}'`
      );
    } else {
      // TODO: this should also receive `src`
      const actorRef = interpret(behavior, {
        id: name || 'anonymous',
        parent: self
      });

      mutCapturedActions.push(
        invoke({
          // @ts-ignore TODO: fix types
          src: actorRef,
          ref: actorRef,
          id: actorRef.id,
          meta: undefined
        }) as any as InvokeActionObject
      );

      return actorRef as any; // TODO: fix types
    }
  };
}
