import { XSTATE_STOP } from '../constants.ts';
import type { AnyActorSystem } from '../system.ts';
import type {
  AnyActor,
  EventObject,
  Snapshot,
  Subscription
} from '../types.ts';

const subscriptions = /* #__PURE__ */ new WeakMap<AnyActor, Subscription>();

/**
 * Internal factory for actor logic that attaches to another actor on start
 * (`enq.listen()` / `enq.subscribeTo()`) and detaches when stopped.
 */
export function createAttachedLogic(
  attach: (
    input: any,
    scope: { self: AnyActor; system: AnyActorSystem }
  ) => Subscription | undefined
): any {
  const initialTransition = (input: unknown, _: unknown) =>
    [
      {
        status: 'active',
        output: undefined,
        error: undefined,
        input
      },
      []
    ] as const;

  return {
    start: (state: any, { self, system }: any) => {
      // Don't attach if the target doesn't exist or is stopped.
      const target = state.input.actor;
      if (!target || target.getSnapshot().status === 'stopped') {
        return;
      }
      const subscription = attach(state.input, { self, system });
      if (!subscription) {
        return;
      }

      // Attached actors are not registered as children (their `input` holds
      // non-serializable function mappers), so a parent stop does not cascade
      // to them. Subscribe to the parent and tear down when it stops/errors,
      // so the subscription never relays to a stopped parent or leaks the
      // source subscription.
      let parentSubscription: Subscription | undefined;
      let torndown = false;
      const teardown = () => {
        if (torndown) {
          return;
        }
        torndown = true;
        subscription.unsubscribe();
        parentSubscription?.unsubscribe();
      };

      const parent: AnyActor | undefined = self._parent;
      if (parent) {
        parentSubscription = parent.subscribe({
          complete: teardown,
          error: teardown
        });
      }

      subscriptions.set(self, { unsubscribe: teardown });
    },
    transition: (state: any, event: EventObject, { self }: any) => {
      if (event.type === XSTATE_STOP) {
        subscriptions.get(self)?.unsubscribe();
        subscriptions.delete(self);
        return [
          {
            ...state,
            status: 'stopped',
            error: undefined
          },
          []
        ];
      }
      return [state, []];
    },
    initialTransition,
    getInitialSnapshot: (actorScope: unknown, input: unknown) =>
      initialTransition(input, actorScope)[0],
    getPersistedSnapshot: (snapshot: Snapshot<unknown>) => snapshot,
    restoreSnapshot: (snapshot: Snapshot<unknown>) => snapshot
  };
}

/**
 * Relays a mapped event to the attached actor's parent, unless the attached
 * actor has been stopped (the mapper is not called in that case).
 */
export function relayMappedToParent(
  self: AnyActor,
  system: AnyActorSystem,
  getEvent: () => EventObject
): void {
  if (self.getSnapshot().status === 'stopped' || !self._parent) {
    return;
  }
  system._relay(self, self._parent, getEvent());
}
