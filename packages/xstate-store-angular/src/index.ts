export * from '@xstate/store';

import {
  DestroyRef,
  Injector,
  assertInInjectionContext,
  inject,
  linkedSignal,
  runInInjectionContext
} from '@angular/core';
import type { Signal } from '@angular/core';
import { type Readable } from '@xstate/store';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

/**
 * An Angular function that creates a signal subscribed to a store, selecting a
 * value via an optional selector function.
 *
 * @example
 *
 * ```ts
 * import { Component } from '@angular/core';
 * import { store } from './store';
 * import { injectStore } from '@xstate/store-angular';
 *
 * @Component({
 *   selector: 'app-counter',
 *   template: `<div>{{ count() }}</div>`
 * })
 * export class CounterComponent {
 *   count = injectStore(store, (state) => state.context.count);
 * }
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the snapshot and returns a selected
 *   value
 * @param compare An optional function which compares the selected value to the
 *   previous value
 * @returns A readonly Signal of the selected value
 */
export function injectStore<TStore extends Readable<any>, TSelected>(
  store: TStore,
  selector?: (state: TStore extends Readable<infer T> ? T : never) => TSelected,
  compare?: (a: TSelected, b: TSelected) => boolean
): Signal<TSelected>;
export function injectStore<TStore extends Readable<any>, TSelected>(
  store: TStore,
  selector: (
    state: TStore extends Readable<infer T> ? T : never
  ) => TSelected = (d) => d as TSelected,
  compare: (a: TSelected, b: TSelected) => boolean = defaultCompare
): Signal<TSelected> {
  assertInInjectionContext(injectStore);
  const injector = inject(Injector);

  return runInInjectionContext(injector, () => {
    const destroyRef = inject(DestroyRef);
    const slice = linkedSignal(() => selector(store.get()), { equal: compare });

    const { unsubscribe } = store.subscribe((s) => {
      slice.set(selector(s));
    });

    destroyRef.onDestroy(() => {
      unsubscribe();
    });

    return slice.asReadonly();
  });
}
