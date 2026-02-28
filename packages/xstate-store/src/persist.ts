import {
  AnyStoreLogic,
  EventObject,
  EventPayloadMap,
  StoreContext,
  StoreExtension,
  StoreLogic,
  StoreSnapshot
} from './types';

/**
 * Storage interface compatible with `localStorage`, `sessionStorage`, and async
 * storage adapters (React Native AsyncStorage, IndexedDB, etc.).
 */
export interface StateStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

/** The envelope persisted to storage. */
export interface PersistStorageValue<TContext> {
  context: Partial<TContext>;
  version: string | number;
}

/** Options for the `persist` store extension. */
export interface PersistOptions<
  TContext = StoreContext,
  TEvent extends EventObject = EventObject
> {
  /** Storage key (required). */
  name: string;
  /** Storage adapter. Defaults to `localStorage`. */
  storage?: StateStorage;
  /** Select which parts of context to persist. Defaults to full context. */
  pick?: (context: TContext) => Partial<TContext>;
  /** Schema version. Defaults to 0. */
  version?: string | number;
  /** Migration function for version upgrades. */
  migrate?: (persistedContext: any, version: string | number) => TContext;
  /**
   * Custom merge strategy when rehydrating. Defaults to shallow merge (`{
   * ...currentContext, ...persistedContext }`).
   */
  merge?: (
    persistedContext: Partial<TContext>,
    currentContext: TContext
  ) => TContext;
  /** Minimum milliseconds between storage writes. Defaults to 0 (immediate). */
  throttle?: number;
  /** Custom serializer. Defaults to `JSON.stringify`. */
  serialize?: (value: PersistStorageValue<TContext>) => string;
  /** Custom deserializer. Defaults to `JSON.parse`. */
  deserialize?: (str: string) => PersistStorageValue<TContext>;
  /**
   * Called after a successful storage write with the persisted context (after
   * `pick`, if provided).
   */
  onDone?: (context: Partial<TContext>) => void;
  /** Called when a storage read or write fails. */
  onError?: (error: unknown) => void;
  /**
   * Controls whether an event should trigger a storage write. Return `false` to
   * skip persisting for that event.
   */
  filter?: (event: TEvent) => boolean;
  /** Skip automatic hydration on store creation. Defaults to `false`. */
  skipHydration?: boolean;
}

// Internal helpers
const PERSIST_INTERNALS: unique symbol = Symbol.for('xstate-store-persist');

interface PersistInternals<TContext> {
  options: PersistOptions<TContext, any>;
  storage: StateStorage;
  pendingContext: Partial<TContext> | null;
  flushTimeoutId: ReturnType<typeof setTimeout> | null;
  flush: () => void;
}

function getStorage(options: PersistOptions<any, any>): StateStorage {
  return options.storage ?? localStorage;
}

function serializeValue<TContext>(
  options: PersistOptions<TContext, any>,
  value: PersistStorageValue<TContext>
): string {
  return options.serialize ? options.serialize(value) : JSON.stringify(value);
}

function deserializeValue<TContext>(
  options: PersistOptions<TContext, any>,
  str: string
): PersistStorageValue<TContext> {
  return options.deserialize ? options.deserialize(str) : JSON.parse(str);
}

function mergeContext<TContext>(
  options: PersistOptions<TContext, any>,
  persistedContext: Partial<TContext>,
  currentContext: TContext
): TContext {
  return options.merge
    ? options.merge(persistedContext, currentContext)
    : { ...currentContext, ...persistedContext };
}

function migrateIfNeeded<TContext>(
  options: PersistOptions<TContext, any>,
  stored: PersistStorageValue<TContext>
): Partial<TContext> {
  const currentVersion = options.version ?? 0;
  if (stored.version !== currentVersion && options.migrate) {
    return options.migrate(stored.context, stored.version) as Partial<TContext>;
  }
  return stored.context;
}

function writeToStorage<TContext>(
  internals: PersistInternals<TContext>,
  context: TContext
): void {
  const { options, storage } = internals;
  const contextToPersist = options.pick ? options.pick(context) : context;

  const value: PersistStorageValue<TContext> = {
    context: contextToPersist,
    version: options.version ?? 0
  };

  try {
    const serialized = serializeValue(options, value);
    const result = storage.setItem(options.name, serialized);
    // Handle async storage writes
    if (result instanceof Promise) {
      result
        .then(() => options.onDone?.(contextToPersist))
        .catch((err) => options.onError?.(err));
    } else {
      options.onDone?.(contextToPersist);
    }
  } catch (err) {
    options.onError?.(err);
  }
}

function createInternals<TContext>(
  options: PersistOptions<TContext, any>
): PersistInternals<TContext> {
  const storage = getStorage(options);

  const internals: PersistInternals<TContext> = {
    options,
    storage,
    pendingContext: null,
    flushTimeoutId: null,
    flush: () => {
      if (internals.flushTimeoutId !== null) {
        clearTimeout(internals.flushTimeoutId);
        internals.flushTimeoutId = null;
      }
      if (internals.pendingContext !== null) {
        writeToStorage(internals, internals.pendingContext as TContext);
        internals.pendingContext = null;
      }
    }
  };

  return internals;
}

// Core logic wrapper

function persistFromLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  logic: StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>,
  options: PersistOptions<TContext, TEvent>
): StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted> {
  const internals = createInternals(options);
  const { storage } = internals;
  const throttleMs = options.throttle ?? 0;

  const enhancedLogic: AnyStoreLogic = {
    getInitialSnapshot: () => {
      const baseSnapshot = logic.getInitialSnapshot();

      if (options.skipHydration) {
        return {
          ...baseSnapshot,
          _persist: { hydrated: false },
          [PERSIST_INTERNALS]: internals
        };
      }

      // Attempt sync read
      try {
        const storedValue = storage.getItem(options.name);

        // Async storage — can't hydrate synchronously
        if (storedValue instanceof Promise) {
          return {
            ...baseSnapshot,
            _persist: { hydrated: false },
            [PERSIST_INTERNALS]: internals
          };
        }

        if (storedValue === null) {
          return {
            ...baseSnapshot,
            _persist: { hydrated: true },
            [PERSIST_INTERNALS]: internals
          };
        }

        const parsed = deserializeValue(options, storedValue);
        const persistedContext = migrateIfNeeded(options, parsed);
        const mergedContext = mergeContext(
          options,
          persistedContext,
          baseSnapshot.context
        );

        return {
          ...baseSnapshot,
          context: mergedContext,
          _persist: { hydrated: true },
          [PERSIST_INTERNALS]: internals
        };
      } catch (err) {
        options.onError?.(err);
        return {
          ...baseSnapshot,
          _persist: { hydrated: true },
          [PERSIST_INTERNALS]: internals
        };
      }
    },

    transition: (snapshot, event) => {
      // Internal rehydrate event (not exposed in trigger types)
      if (event.type === '__persist.rehydrate') {
        const rawState = event.state as string | null | undefined;

        if (!rawState) {
          return [
            { ...snapshot, _persist: { ...snapshot._persist, hydrated: true } },
            []
          ];
        }

        try {
          const parsed = deserializeValue(options, rawState);
          const persistedContext = migrateIfNeeded(options, parsed);
          const mergedContext = mergeContext(
            options,
            persistedContext,
            snapshot.context
          );

          return [
            {
              ...snapshot,
              context: mergedContext,
              _persist: { ...snapshot._persist, hydrated: true }
            },
            []
          ];
        } catch (err) {
          options.onError?.(err);
          return [
            {
              ...snapshot,
              _persist: { ...snapshot._persist, hydrated: true }
            },
            []
          ];
        }
      }

      // Delegate to wrapped logic
      const [nextSnapshot, effects] = logic.transition(snapshot, event);

      // Preserve _persist metadata
      const snapshotWithMeta = {
        ...nextSnapshot,
        _persist: snapshot._persist ?? { hydrated: false },
        [PERSIST_INTERNALS]: internals
      };

      // Don't write to storage until hydrated
      if (!snapshotWithMeta._persist?.hydrated) {
        return [snapshotWithMeta, effects];
      }

      // Check filter
      if (options.filter && !options.filter(event as TEvent)) {
        return [snapshotWithMeta, effects];
      }

      // Schedule storage write
      if (throttleMs > 0) {
        // Throttled: buffer context, schedule delayed write
        internals.pendingContext = options.pick
          ? (options.pick(nextSnapshot.context) as any)
          : nextSnapshot.context;

        if (internals.flushTimeoutId === null) {
          const persistEffect = () => {
            internals.flushTimeoutId = setTimeout(() => {
              internals.flush();
            }, throttleMs);
          };
          return [snapshotWithMeta, [...effects, persistEffect]];
        }

        return [snapshotWithMeta, effects];
      }

      // Immediate write as effect
      const persistEffect = () => {
        writeToStorage(internals, nextSnapshot.context);
      };

      return [snapshotWithMeta, [...effects, persistEffect]];
    }
  };

  return enhancedLogic;
}

// Public API

/**
 * Creates a store extension that persists context to storage.
 *
 * @example
 *
 * ```ts
 * import { persist } from '@xstate/store/persist';
 *
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(persist({ name: 'my-store' }));
 * ```
 *
 * @example
 *
 * ```ts
 * // Throttled writes with callbacks
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(
 *   persist({
 *     name: 'my-store',
 *     throttle: 1000,
 *     onDone: (ctx) => console.log('Persisted:', ctx),
 *     onError: (err) => console.error('Persist failed:', err)
 *   })
 * );
 * ```
 *
 * @example
 *
 * ```ts
 * // Async storage with manual rehydration
 * import {
 *   persist,
 *   rehydrateStore,
 *   createJSONStorage
 * } from '@xstate/store/persist';
 *
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(
 *   persist({
 *     name: 'my-store',
 *     storage: createJSONStorage(() => AsyncStorage),
 *     skipHydration: true
 *   })
 * );
 *
 * await rehydrateStore(store);
 * ```
 */
export function persist<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  options: PersistOptions<TContext>
): StoreExtension<TContext, TEventPayloadMap, {}, TEmitted> {
  return (logic: any) => persistFromLogic(logic, options);
}

/**
 * Creates a storage adapter with error handling and SSR safety.
 *
 * @example
 *
 * ```ts
 * import { createJSONStorage } from '@xstate/store/persist';
 *
 * // Safe for SSR — returns noop storage if localStorage is unavailable
 * const storage = createJSONStorage(() => localStorage);
 *
 * // Async storage (React Native)
 * const asyncStorage = createJSONStorage(() => AsyncStorage);
 * ```
 */
export function createJSONStorage(
  getStorage: () => StateStorage
): StateStorage {
  let storage: StateStorage | undefined;
  try {
    storage = getStorage();
  } catch {
    // SSR or environments without storage — return noop
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
  }

  return {
    getItem: (name) => {
      try {
        return storage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        storage.setItem(name, value);
      } catch {
        // Swallow write errors (quota exceeded, etc.)
      }
    },
    removeItem: (name) => {
      try {
        storage.removeItem(name);
      } catch {
        // Swallow errors
      }
    }
  };
}

/**
 * Removes persisted data from storage for a store that uses the `persist`
 * extension.
 *
 * @example
 *
 * ```ts
 * import { clearStorage } from '@xstate/store/persist';
 *
 * clearStorage(store);
 * ```
 */
export function clearStorage(store: { getSnapshot: () => any }): void {
  const internals = store.getSnapshot()?.[PERSIST_INTERNALS] as
    | PersistInternals<any>
    | undefined;
  if (!internals) {
    throw new Error('clearStorage: store does not have a persist extension');
  }
  internals.storage.removeItem(internals.options.name);
}

/**
 * Forces an immediate write of any pending throttled context to storage.
 *
 * @example
 *
 * ```ts
 * import { flushStorage } from '@xstate/store/persist';
 *
 * // Force write before page unload
 * window.addEventListener('beforeunload', () => {
 *   flushStorage(store);
 * });
 * ```
 */
export function flushStorage(store: { getSnapshot: () => any }): void {
  const internals = store.getSnapshot()?.[PERSIST_INTERNALS] as
    | PersistInternals<any>
    | undefined;
  if (!internals) {
    throw new Error('flushStorage: store does not have a persist extension');
  }
  internals.flush();
}

/**
 * Reads persisted state from (potentially async) storage and rehydrates the
 * store. Use this for async storage adapters or when `skipHydration` is
 * `true`.
 *
 * @example
 *
 * ```ts
 * import { rehydrateStore } from '@xstate/store/persist';
 *
 * const store = createStore({ ... }).with(persist({
 *   name: 'my-store',
 *   storage: createJSONStorage(() => AsyncStorage),
 *   skipHydration: true
 * }));
 *
 * await rehydrateStore(store);
 * ```
 */
export async function rehydrateStore(store: {
  getSnapshot: () => any;
  send: (event: any) => void;
}): Promise<void> {
  const internals = store.getSnapshot()?.[PERSIST_INTERNALS] as
    | PersistInternals<any>
    | undefined;
  if (!internals) {
    throw new Error('rehydrateStore: store does not have a persist extension');
  }
  const data = await internals.storage.getItem(internals.options.name);
  store.send({ type: '__persist.rehydrate', state: data });
}
