import { useMemo, useRef } from 'react';
import { useSubscription } from 'use-subscription';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import { ActorRef, Interpreter, Subscribable } from 'xstate';
import { isActorWithState } from './useActor';
import { getServiceSnapshot } from './utils';

function isService(actor: any): actor is Interpreter<any, any, any, any> {
  return 'state' in actor && 'machine' in actor;
}

const defaultCompare = (a, b) => a === b;
const defaultGetSnapshot = (a) =>
  isService(a)
    ? getServiceSnapshot(a)
    : isActorWithState(a)
    ? a.state
    : undefined;

export function useSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = defaultGetSnapshot
) {
  const latestSelectorRef = useRef(selector);

  const subscription = useMemo(() => {
    let snapshot = getSnapshot(actor);
    let current = selector(snapshot);
    let notifySubscriber: () => void;

    return {
      getSnapshot: () => snapshot,
      getCurrentValue: () => current,
      setCurrentValue: (newCurrent: typeof current) => {
        current = newCurrent;
        notifySubscriber?.();
      },
      subscribe: (callback) => {
        notifySubscriber = callback;
        const sub = actor.subscribe((emitted) => {
          snapshot = emitted;

          const next = latestSelectorRef.current(emitted);
          if (!compare(current, next)) {
            current = next;
            callback();
          }
        });
        return () => {
          sub.unsubscribe();
        };
      }
    };
    // intentionally omit `getSnapshot` and `compare`
    // - `getSnapshot`: it is only supposed to read the "initial" snapshot of an actor
    // - `compare`: is really supposed to be idempotent and the same throughout the lifetime of this hook (the same assumption is made in React Redux v7)
  }, [actor]);

  let currentSelected = useSubscription(subscription);
  let currentChanged = false;

  if (latestSelectorRef.current !== selector) {
    let selected = selector(subscription.getSnapshot());
    if (!compare(currentSelected, selected)) {
      currentChanged = true;
      currentSelected = selected;
    }
  }

  useIsomorphicLayoutEffect(() => {
    latestSelectorRef.current = selector;
    // this condition should not be required, but setState bailouts are currently buggy: https://github.com/facebook/react/issues/22654
    if (currentChanged) {
      // required so we don't cause a rerender by setting state (this could create infinite rerendering loop with inline selectors)
      // at the same time we need to update the value within the subscription so new emits can compare against what has been returned to the user as current value
      subscription.setCurrentValue(currentSelected);
    }
  });

  return currentSelected;
}
