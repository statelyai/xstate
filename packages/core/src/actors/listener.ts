import { XSTATE_STOP } from '../constants.ts';
import { AnyActorSystem } from '../system.ts';
import { matchesEventDescriptor } from '../utils.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  AnyActorRef,
  EventObject,
  Snapshot,
  Subscription
} from '../types';

// Instance state for listener actors
interface ListenerInstanceState {
  subscription: Subscription | undefined;
}

const listenerInstanceStates = /* #__PURE__ */ new WeakMap<
  AnyActorRef,
  ListenerInstanceState
>();

export type ListenerSnapshot = Snapshot<undefined> & {
  input: ListenerInput<any, any>;
};

export interface ListenerInput<
  TEmitted extends EventObject,
  TMappedEvent extends EventObject
> {
  actor: AnyActorRef;
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
  const logic: ListenerActorLogic<TEmitted, TMappedEvent> = {
    start: (state, actorScope) => {
      const { self, system } = actorScope;
      const { actor, eventType, mapper } = state.input;

      console.log('[LISTENER] start called', {
        eventType,
        actorId: actor?.id,
        selfParent: self._parent?.id
      });

      const listenerState: ListenerInstanceState = {
        subscription: undefined
      };

      listenerInstanceStates.set(self, listenerState);

      // Don't subscribe if target actor doesn't exist or is stopped
      if (!actor || actor.getSnapshot().status === 'stopped') {
        console.log('[LISTENER] Actor is null or stopped, not subscribing');
        return;
      }

      // Determine the subscription type:
      // - For exact matches or '*', subscribe directly
      // - For partial wildcards ('data.*'), subscribe to '*' and filter
      const isPartialWildcard = eventType !== '*' && eventType.endsWith('.*');
      const subscriptionType = isPartialWildcard ? '*' : eventType;

      console.log('[LISTENER] Subscribing to', subscriptionType);

      // Subscribe to emitted events using actor.on()
      listenerState.subscription = actor.on(
        subscriptionType,
        (emittedEvent) => {
          console.log('[LISTENER] Event received:', emittedEvent);
          // Check if this listener is still active
          if (self.getSnapshot().status === 'stopped') {
            console.log('[LISTENER] Listener is stopped, ignoring');
            return;
          }

          // For partial wildcards, filter using our matching algorithm
          if (isPartialWildcard) {
            if (!matchesEventDescriptor(emittedEvent.type, eventType)) {
              console.log('[LISTENER] Event does not match wildcard, ignoring');
              return;
            }
          }

          const mappedEvent = mapper(emittedEvent as TEmitted);
          console.log(
            '[LISTENER] Mapped event:',
            mappedEvent,
            'Parent:',
            self._parent?.id
          );
          if (self._parent) {
            system._relay(self, self._parent, mappedEvent);
            console.log('[LISTENER] Relayed to parent');
          } else {
            console.log('[LISTENER] No parent to relay to!');
          }
        }
      );
    },
    transition: (state, event, actorScope) => {
      if (event.type === XSTATE_STOP) {
        const listenerState = listenerInstanceStates.get(actorScope.self);

        if (listenerState?.subscription) {
          listenerState.subscription.unsubscribe();
        }

        listenerInstanceStates.delete(actorScope.self);

        return {
          ...state,
          status: 'stopped',
          error: undefined
        };
      }

      return state;
    },
    getInitialSnapshot: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        input
      };
    },
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot: any) => snapshot
  };

  return logic;
}

// Singleton logic instance
export const listenerLogic = /* #__PURE__ */ createListenerLogic();
