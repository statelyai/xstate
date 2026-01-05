export * from '@xstate/store';

import {
  DestroyRef,
  Injector,
  assertInInjectionContext,
  inject,
  linkedSignal,
  runInInjectionContext
} from '@angular/core';
import type { CreateSignalOptions, Signal } from '@angular/core';
import { shallowEqual, type Readable } from '@xstate/store';

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
 * @param options Optional signal creation options with compare function and
 *   injector
 * @returns A readonly Signal of the selected value
 */
export function injectStore<TStore extends Readable<any>, TSelected>(
  store: TStore,
  selector?: (state: TStore extends Readable<infer T> ? T : never) => TSelected,
  options?: CreateSignalOptions<TSelected> & { injector?: Injector }
): Signal<TSelected>;
export function injectStore<TStore extends Readable<any>, TSelected>(
  store: TStore,
  selector: (
    state: TStore extends Readable<infer T> ? T : never
  ) => TSelected = (d) => d as TSelected,
  options: CreateSignalOptions<TSelected> & { injector?: Injector } = {
    equal: shallowEqual
  }
): Signal<TSelected> {
  !options.injector && assertInInjectionContext(injectStore);

  if (!options.injector) {
    options.injector = inject(Injector);
  }

  return runInInjectionContext(options.injector, () => {
    const destroyRef = inject(DestroyRef);
    const slice = linkedSignal(() => selector(store.get()), options);

    const { unsubscribe } = store.subscribe((s) => {
      slice.set(selector(s));
    });

    destroyRef.onDestroy(() => {
      unsubscribe();
    });

    return slice.asReadonly();
  });
}
