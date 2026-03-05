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

export type ZustandCreator<TState> = (
  set: ZustandSet<TState>,
  get: ZustandGet<TState>
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
  'zustand.set': {
    partial: Partial<ExtractZustandContext<TState>>;
    replace: boolean;
  };
};

// ---------------------------------------------------------------------------
// Implementation
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

/**
 * Creates an xstate store from a Zustand-style creator function.
 *
 * Synchronous `set()` calls within an action are captured and applied as a
 * single atomic context update (the transition return value). Asynchronous
 * `set()` calls (after `await`) dispatch a `zustand.set` event to the store.
 *
 * @example
 *
 * ```ts
 * const store = createStoreFromZustand((set) => ({
 *   count: 0,
 *   increment: (qty: number) =>
 *     set((state) => ({ count: state.count + qty })),
 *   decrement: (qty: number) =>
 *     set((state) => ({ count: state.count - qty }))
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
  type TContext = ExtractZustandContext<TState>;

  // --- Phase tracking (scoped per store instance) ---
  let syncPhase = false;
  let syncCapture: Record<string, any> = {};
  let syncReplace = false;
  let storeRef: Store<any, any, any> | null = null;

  /** Stable references to action functions from the creator */
  const actionRefs: Record<string, Function> = {};

  /** Build full Zustand-style state (context + action fns) */
  function getFullState(): TState {
    const ctx = storeRef ? storeRef.getSnapshot().context : initialContext;
    return { ...ctx, ...actionRefs } as TState;
  }

  // --- set / get passed to the creator ---
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
    } else {
      // Async: dispatch to store
      storeRef!.send({
        type: 'zustand.set',
        partial,
        replace: replace ?? false
      } as any);
    }
  };

  const get: ZustandGet<TState> = () => getFullState();

  // --- Discover shape by calling the creator ---
  const initialContext: Record<string, any> = {};
  const initialState = creator(set, get);
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

  // Generic handler for async set calls
  on['zustand.set'] = (ctx, event) => {
    const partial = event.partial as Record<string, any>;
    if (event.replace) {
      return partial as TContext;
    }
    return { ...ctx, ...partial };
  };

  // --- Create the store ---
  const store = createStore({
    context: initialContext as TContext,
    on
  });
  storeRef = store as any;

  return store as any;
}
