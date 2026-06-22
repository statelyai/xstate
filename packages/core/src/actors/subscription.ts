import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  AnyActorRef,
  EventObject,
  Snapshot
} from '../types';
import { createAttachedLogic, relayMappedToParent } from './attached.ts';

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
  return createAttachedLogic(({ actor, mappers }, { self, system }) => {
    const { done, error, snapshot: onSnapshot } = mappers;

    return actor.subscribe({
      next: (snapshot: TSnapshot) => {
        if (snapshot.status === 'done' && done) {
          relayMappedToParent(self, system, () =>
            done(snapshot.output as TOutput)
          );
        } else if (snapshot.status === 'error' && error) {
          relayMappedToParent(self, system, () => error(snapshot.error));
        } else if (snapshot.status === 'active' && onSnapshot) {
          relayMappedToParent(self, system, () => onSnapshot(snapshot));
        }
      },
      error: (err: unknown) => {
        if (error) {
          relayMappedToParent(self, system, () => error(err));
        }
      },
      complete: () => {
        // Actor completed without output (stopped); no action needed
      }
    });
  });
}

// Singleton logic instance
export const subscriptionLogic = /* #__PURE__ */ createSubscriptionLogic();
