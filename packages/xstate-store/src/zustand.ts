import { useRef, useSyncExternalStore } from 'react';
import { createStore } from './store';
import type { EventObject, Store } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ZustandSet<TState> = (
  partial:
    | TState
    | Partial<TState>
    | ((state: TState) => TState | Partial<TState>),
  replace?: boolean
) => void;

type ZustandGet<TState> = () => TState;

export type ZustandApi<TState> = {
  setState: ZustandSet<TState>;
  getState: ZustandGet<TState>;
  getInitialState: () => TState;
  subscribe: (listener: (state: TState, prev: TState) => void) => () => void;
};

export type ZustandCreator<TState> = (
  set: ZustandSet<TState>,
  get: ZustandGet<TState>,
  api: ZustandApi<TState>
) => TState;

/** Extract non-function properties (context/state data) */
type ExtractZustandContext<TState> = {
  [K in keyof TState as TState[K] extends (...args: any[]) => any
    ? never
    : K]: TState[K];
};

/** Extract function properties (actions) */
type ExtractZustandActions<TState> = {
  [K in keyof TState as TState[K] extends (...args: any[]) => any
    ? K
    : never]: TState[K];
};

/** Build the event payload map from zustand actions */
type ZustandEventPayloadMap<TState> = {
  [K in keyof ExtractZustandActions<TState> & string]: {
    args: ExtractZustandActions<TState>[K] extends (...args: infer A) => any
      ? A
      : never;
  };
} & {
  dangerouslySet: {
    partial: Partial<ExtractZustandContext<TState>>;
    replace: boolean;
  };
};

/** Zustand-compatible hook with store API methods attached */
export type UseBoundStore<TState> = {
  (): TState;
  <U>(selector: (state: TState) => U): U;
  getState: () => TState;
  setState: ZustandSet<TState>;
  subscribe: (listener: (state: TState, prev: TState) => void) => () => void;
  getInitialState: () => TState;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterNonFunctions(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] !== 'function') {
      result[key] = obj[key];
    }
  }
  return result;
}

function defaultCompare<T>(a: T | undefined, b: T) {
  return Object.is(a, b);
}

// ---------------------------------------------------------------------------
// Internal: shared core that both createStoreFromZustand and create use
// ---------------------------------------------------------------------------

interface ZustandStoreInternal<TState extends Record<string, any>> {
  store: Store<
    ExtractZustandContext<TState>,
    ZustandEventPayloadMap<TState>,
    EventObject
  >;
  actionNames: string[];
}

function _createInternal<TState extends Record<string, any>>(
  creator: ZustandCreator<TState>
): ZustandStoreInternal<TState> {
  type TContext = ExtractZustandContext<TState>;

  // --- Phase tracking ---
  let initPhase = true;
  let syncPhase = false;
  let syncCapture: Record<string, any> = {};
  let syncReplace = false;
  let storeRef: Store<any, any, any> | null = null;

  const actionRefs: Record<string, Function> = {};
  let initialContext: Record<string, any> = {};

  function getFullState(): TState {
    const ctx = storeRef ? storeRef.getSnapshot().context : initialContext;
    return { ...ctx, ...actionRefs } as TState;
  }

  const set: ZustandSet<TState> = (partialOrUpdater, replace) => {
    const current = getFullState();
    const raw =
      typeof partialOrUpdater === 'function'
        ? (partialOrUpdater as (s: TState) => Partial<TState>)(current)
        : partialOrUpdater;
    const partial = filterNonFunctions(raw as Record<string, any>);

    if (syncPhase) {
      if (replace) {
        syncCapture = partial;
        syncReplace = true;
      } else {
        Object.assign(syncCapture, partial);
      }
    } else if (initPhase) {
      if (replace) {
        initialContext = partial;
      } else {
        Object.assign(initialContext, partial);
      }
    } else {
      storeRef!.send({
        type: 'dangerouslySet',
        partial,
        replace: replace ?? false
      } as any);
    }
  };

  const get: ZustandGet<TState> = () => getFullState();

  const api: ZustandApi<TState> = {
    setState: set,
    getState: get,
    getInitialState: () => getFullState(),
    subscribe: (listener) => {
      if (!storeRef) {
        return () => {};
      }
      let prevState = getFullState();
      const sub = storeRef.subscribe((snapshot) => {
        const newState = { ...snapshot.context, ...actionRefs } as TState;
        const prev = prevState;
        prevState = newState;
        listener(newState, prev);
      });
      return () => sub.unsubscribe();
    }
  };

  // --- Discover shape ---
  const initialState = creator(set, get, api);
  initPhase = false;
  const actions: Record<string, Function> = {};

  for (const [key, value] of Object.entries(
    initialState as Record<string, any>
  )) {
    if (typeof value === 'function') {
      actions[key] = value;
      actionRefs[key] = value;
    } else {
      initialContext[key] = value;
    }
  }

  // --- Build transitions ---
  const on: Record<string, (ctx: any, event: any) => any> = {};

  for (const actionName of Object.keys(actions)) {
    on[actionName] = (ctx, event) => {
      syncPhase = true;
      syncCapture = {};
      syncReplace = false;

      const args: any[] = event.args ?? [];
      actions[actionName](...args);

      const captured = { ...syncCapture };
      const wasReplace = syncReplace;
      syncPhase = false;

      if (Object.keys(captured).length === 0) {
        return ctx;
      }
      return wasReplace ? captured : { ...ctx, ...captured };
    };
  }

  on['dangerouslySet'] = (ctx, event) => {
    const partial = event.partial as Record<string, any>;
    if (event.replace) {
      return partial as TContext;
    }
    return { ...ctx, ...partial };
  };

  const store = createStore({
    context: initialContext as TContext,
    on
  });
  storeRef = store as any;

  return {
    store: store as any,
    actionNames: Object.keys(actions)
  };
}

// ---------------------------------------------------------------------------
// createStoreFromZustand — vanilla (no React)
// ---------------------------------------------------------------------------

/**
 * Creates an xstate store from a Zustand-style creator function.
 *
 * Synchronous `set()` calls within an action are captured and applied as a
 * single atomic context update. Asynchronous `set()` calls (after `await`)
 * dispatch a `dangerouslySet` event to the store.
 *
 * @example
 *
 * ```ts
 * const store = createStoreFromZustand((set) => ({
 *   count: 0,
 *   increment: (qty: number) =>
 *     set((state) => ({ count: state.count + qty }))
 * }));
 *
 * store.trigger.increment(1);
 * store.getSnapshot().context; // { count: 1 }
 * ```
 */
export function createStoreFromZustand<TState extends Record<string, any>>(
  creator: ZustandCreator<TState>
): Store<
  ExtractZustandContext<TState>,
  ZustandEventPayloadMap<TState>,
  EventObject
> {
  return _createInternal(creator).store;
}

// ---------------------------------------------------------------------------
// create — React hook (like Zustand's `create`)
// ---------------------------------------------------------------------------

/**
 * Creates a Zustand-compatible React hook backed by an xstate store.
 *
 * Drop-in replacement for `import { create } from 'zustand'`. Returns a hook
 * with `.getState()`, `.setState()`, `.subscribe()`, and `.getInitialState()`
 * attached, just like Zustand.
 *
 * @example
 *
 * ```ts
 * import { create } from '@xstate/store/zustand';
 *
 * const useStore = create((set) => ({
 *   count: 0,
 *   increment: () => set((s) => ({ count: s.count + 1 }))
 * }));
 *
 * // In a component:
 * const count = useStore((s) => s.count);
 * const { increment } = useStore();
 *
 * // Outside components:
 * useStore.getState().count;
 * useStore.setState({ count: 5 });
 * ```
 */
export function create<TState extends Record<string, any>>(
  creator: ZustandCreator<TState>
): UseBoundStore<TState> {
  const { store, actionNames } = _createInternal(creator);

  // Stable trigger-backed action functions
  const triggerActions: Record<string, (...args: any[]) => void> = {};
  for (const name of actionNames) {
    triggerActions[name] = (...args: any[]) =>
      (store.trigger as any)[name](...args);
  }

  // Cached merged state (context + action fns)
  let cachedContext: any = null;
  let cachedState: TState | null = null;

  function getMergedState(): TState {
    const ctx = store.getSnapshot().context;
    if (ctx === cachedContext && cachedState) {
      return cachedState;
    }
    cachedContext = ctx;
    cachedState = { ...ctx, ...triggerActions } as TState;
    return cachedState;
  }

  // Stable subscribe fn for useSyncExternalStore
  const subscribe = (cb: () => void) => {
    const sub = store.subscribe(cb);
    return () => sub.unsubscribe();
  };

  // The hook
  function useZustandStore(): TState;
  function useZustandStore<U>(selector: (state: TState) => U): U;
  function useZustandStore<U>(selector?: (state: TState) => U) {
    const sel = selector ?? ((s: TState) => s as unknown as U);

    const previous = useRef<{ value: U | TState } | undefined>(undefined);

    const getSnapshot = () => {
      const state = getMergedState();
      const next = sel(state);
      if (
        previous.current !== undefined &&
        defaultCompare(previous.current.value, next)
      ) {
        return previous.current.value;
      }
      previous.current = { value: next };
      return next;
    };

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  // Attach Zustand-compatible API
  const boundStore = Object.assign(useZustandStore, {
    getState: getMergedState,
    setState: ((partialOrUpdater: any, replace?: boolean) => {
      const current = getMergedState();
      const raw =
        typeof partialOrUpdater === 'function'
          ? partialOrUpdater(current)
          : partialOrUpdater;
      const partial = filterNonFunctions(raw as Record<string, any>);
      store.send({
        type: 'dangerouslySet',
        partial,
        replace: replace ?? false
      } as any);
    }) as ZustandSet<TState>,
    subscribe: (listener: (state: TState, prev: TState) => void) => {
      let prevState = getMergedState();
      const sub = store.subscribe(() => {
        const newState = getMergedState();
        const prev = prevState;
        prevState = newState;
        listener(newState, prev);
      });
      return () => sub.unsubscribe();
    },
    getInitialState: () => {
      const ctx = store.getInitialSnapshot().context;
      return { ...ctx, ...triggerActions } as TState;
    }
  });

  return boundStore as UseBoundStore<TState>;
}
