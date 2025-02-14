import type { Store, StoreContext, EventObject } from './types';

export type Selector<TContext, TSelected> = (context: TContext) => TSelected;

export interface Selection<TSelected> {
  subscribe: (callback: (selected: TSelected) => void) => {
    unsubscribe: () => void;
  };
  get: () => TSelected;
}

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
    subscribe: (callback: (selected: TSelected) => void) => {
      let previousSelected = selector(store.getSnapshot().context);

      return store.subscribe((snapshot) => {
        const nextSelected = selector(snapshot.context);
        if (!equalityFn(previousSelected, nextSelected)) {
          previousSelected = nextSelected;
          callback(nextSelected);
        }
      });
    },
    get: () => selector(store.getSnapshot().context)
  };
}
