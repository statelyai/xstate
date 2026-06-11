import { XSTATE_STOP } from '../constants.ts';
import type { AnyActorSystem } from '../system.ts';
import type {
  AnyActorRef,
  EventObject,
  Snapshot,
  Subscription
} from '../types.ts';

const subscriptions = /* #__PURE__ */ new WeakMap<AnyActorRef, Subscription>();

/**
 * Internal factory for actor logic that attaches to another actor on start
 * (`enq.listen()` / `enq.subscribeTo()`) and detaches when stopped.
 */
export function createAttachedLogic(
  attach: (
    input: any,
    scope: { self: AnyActorRef; system: AnyActorSystem }
  ) => Subscription | undefined
): any {
  return {
    start: (state: any, { self, system }: any) => {
      // Don't attach if the target actor doesn't exist or is stopped
      if (
        !state.input.actor ||
        state.input.actor.getSnapshot().status === 'stopped'
      ) {
        return;
      }
      const subscription = attach(state.input, { self, system });
      if (subscription) {
        subscriptions.set(self, subscription);
      }
    },
    transition: (state: any, event: EventObject, { self }: any) => {
      if (event.type === XSTATE_STOP) {
        subscriptions.get(self)?.unsubscribe();
        subscriptions.delete(self);
        return {
          ...state,
          status: 'stopped',
          error: undefined
        };
      }
      return state;
    },
    getInitialSnapshot: (_: unknown, input: unknown) => ({
      status: 'active',
      output: undefined,
      error: undefined,
      input
    }),
    getPersistedSnapshot: (snapshot: Snapshot<unknown>) => snapshot,
    restoreSnapshot: (snapshot: Snapshot<unknown>) => snapshot
  };
}

/**
 * Relays a mapped event to the attached actor's parent, unless the attached
 * actor has been stopped (the mapper is not called in that case).
 */
export function relayMappedToParent(
  self: AnyActorRef,
  system: AnyActorSystem,
  getEvent: () => EventObject
): void {
  if (self.getSnapshot().status === 'stopped' || !self._parent) {
    return;
  }
  system._relay(self, self._parent, getEvent());
}
