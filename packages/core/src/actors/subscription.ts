import { XSTATE_STOP } from '../constants.ts';
import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  AnyActorRef,
  EventObject,
  Snapshot,
  Subscription
} from '../types';

// Instance state for subscription actors
interface SubscriptionInstanceState {
  subscription: Subscription | undefined;
}

const subscriptionInstanceStates = /* #__PURE__ */ new WeakMap<
  AnyActorRef,
  SubscriptionInstanceState
>();

export type SubscriptionSnapshot = Snapshot<undefined> & {
  input: SubscriptionInput<any, any, any, any>;
};

export interface SubscriptionMappers<
  TSnapshot extends Snapshot<unknown>,
  TOutput,
  TMappedEvent extends EventObject
> {
  snapshot?: (snapshot: TSnapshot) => TMappedEvent;
  done?: (output: TOutput) => TMappedEvent;
  error?: (error: unknown) => TMappedEvent;
}

export interface SubscriptionInput<
  TSnapshot extends Snapshot<unknown>,
  TOutput,
  TMappedEvent extends EventObject,
  TMappers extends SubscriptionMappers<TSnapshot, TOutput, TMappedEvent>
> {
  actor: AnyActorRef;
  mappers: TMappers;
}

export type SubscriptionActorLogic<
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TOutput = unknown,
  TMappedEvent extends EventObject = EventObject
> = ActorLogic<
  SubscriptionSnapshot,
  EventObject,
  SubscriptionInput<
    TSnapshot,
    TOutput,
    TMappedEvent,
    SubscriptionMappers<TSnapshot, TOutput, TMappedEvent>
  >,
  AnyActorSystem,
  EventObject
>;

export type SubscriptionActorRef<
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TOutput = unknown,
  TMappedEvent extends EventObject = EventObject
> = ActorRefFromLogic<SubscriptionActorLogic<TSnapshot, TOutput, TMappedEvent>>;

/**
 * Creates actor logic for subscribing to lifecycle events (done/error/snapshot)
 * from another actor. Used internally by `enq.subscribeTo()`.
 */
export function createSubscriptionLogic<
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TOutput = unknown,
  TMappedEvent extends EventObject = EventObject
>(): SubscriptionActorLogic<TSnapshot, TOutput, TMappedEvent> {
  const logic: SubscriptionActorLogic<TSnapshot, TOutput, TMappedEvent> = {
    start: (state, actorScope) => {
      const { self, system } = actorScope;
      const { actor, mappers } = state.input;

      const subscriptionState: SubscriptionInstanceState = {
        subscription: undefined
      };

      subscriptionInstanceStates.set(self, subscriptionState);

      // Don't subscribe if target actor doesn't exist or is stopped
      if (!actor || actor.getSnapshot().status === 'stopped') {
        return;
      }

      // Subscribe to the actor's lifecycle
      subscriptionState.subscription = actor.subscribe({
        next: (snapshot: TSnapshot) => {
          // Check if this subscription is still active
          if (self.getSnapshot().status === 'stopped') {
            return;
          }

          // Handle done status
          if (snapshot.status === 'done' && mappers.done) {
            const mappedEvent = mappers.done(snapshot.output as TOutput);
            if (self._parent) {
              system._relay(self, self._parent, mappedEvent);
            }
            return;
          }

          // Handle error status
          if (snapshot.status === 'error' && mappers.error) {
            const mappedEvent = mappers.error(snapshot.error);
            if (self._parent) {
              system._relay(self, self._parent, mappedEvent);
            }
            return;
          }

          // Handle snapshot changes (only for active status)
          if (snapshot.status === 'active' && mappers.snapshot) {
            const mappedEvent = mappers.snapshot(snapshot);
            if (self._parent) {
              system._relay(self, self._parent, mappedEvent);
            }
          }
        },
        error: (err: unknown) => {
          // Check if this subscription is still active
          if (self.getSnapshot().status === 'stopped') {
            return;
          }

          if (mappers.error) {
            const mappedEvent = mappers.error(err);
            if (self._parent) {
              system._relay(self, self._parent, mappedEvent);
            }
          }
        },
        complete: () => {
          // Actor completed without output (stopped)
          // No action needed
        }
      });
    },
    transition: (state, event, actorScope) => {
      if (event.type === XSTATE_STOP) {
        const subscriptionState = subscriptionInstanceStates.get(
          actorScope.self
        );

        if (subscriptionState?.subscription) {
          subscriptionState.subscription.unsubscribe();
        }

        subscriptionInstanceStates.delete(actorScope.self);

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
export const subscriptionLogic = /* #__PURE__ */ createSubscriptionLogic();
