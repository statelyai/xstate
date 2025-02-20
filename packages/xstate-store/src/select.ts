import { toObserver } from './toObserver';
import type {
  Store,
  StoreContext,
  EventObject,
  Selector,
  Selection
} from './types';
export function select<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TSelected
>(
  store: Store<TContext, TEvent, TEmitted>,
  selector: Selector<TContext, TSelected>,
  equalityFn: (a: TSelected, b: TSelected) => boolean = Object.is
): Selection<TSelected> {
  return {
    subscribe: (observerOrFn) => {
      const observer = toObserver(observerOrFn);
      let previousSelected = selector(store.getSnapshot().context);

      return store.subscribe((snapshot) => {
        const nextSelected = selector(snapshot.context);
        if (!equalityFn(previousSelected, nextSelected)) {
          previousSelected = nextSelected;
          observer.next?.(nextSelected);
        }
      });
    },
    get: () => selector(store.getSnapshot().context)
  };
}
