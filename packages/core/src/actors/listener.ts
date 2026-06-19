import { AnyActorSystem } from '../system.ts';
import { matchesEventDescriptor } from '../utils.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  AnyActor,
  EventObject,
  Snapshot
} from '../types';
import { createAttachedLogic, relayMappedToParent } from './attached.ts';

export type ListenerSnapshot = Snapshot<undefined> & {
  input: ListenerInput<any, any>;
};

export interface ListenerInput<
  TEmitted extends EventObject,
  TMappedEvent extends EventObject
> {
  actor: AnyActor;
  eventType: string;
  mapper: (event: TEmitted) => TMappedEvent;
}

export type ListenerActorLogic<
  TEmitted extends EventObject = EventObject,
  TMappedEvent extends EventObject = EventObject
> = ActorLogic<
  ListenerSnapshot,
  EventObject,
  ListenerInput<TEmitted, TMappedEvent>,
  AnyActorSystem,
  EventObject
>;

export type ListenerActorRef<
  TEmitted extends EventObject = EventObject,
  TMappedEvent extends EventObject = EventObject
> = ActorRefFromLogic<ListenerActorLogic<TEmitted, TMappedEvent>>;

/**
 * Creates actor logic for listening to emitted events from another actor. Used
 * internally by `enq.listen()`.
 */
export function createListenerLogic<
  TEmitted extends EventObject = EventObject,
  TMappedEvent extends EventObject = EventObject
>(): ListenerActorLogic<TEmitted, TMappedEvent> {
  return createAttachedLogic(
    (
      { actor, eventType, mapper }: ListenerInput<TEmitted, TMappedEvent>,
      { self, system }
    ) => {
      // Determine the subscription type:
      // - For exact matches or '*', subscribe directly
      // - For partial wildcards ('data.*'), subscribe to '*' and filter
      const isPartialWildcard = eventType !== '*' && eventType.endsWith('.*');

      return actor.on(isPartialWildcard ? '*' : eventType, (emittedEvent) => {
        if (
          isPartialWildcard &&
          !matchesEventDescriptor(emittedEvent.type, eventType)
        ) {
          return;
        }
        relayMappedToParent(self, system, () =>
          mapper(emittedEvent as TEmitted)
        );
      });
    }
  );
}

// Singleton logic instance
export const listenerLogic = /* #__PURE__ */ createListenerLogic();
