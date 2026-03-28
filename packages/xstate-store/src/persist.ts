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

/** The envelope persisted to storage for snapshot strategy. @public */
export interface PersistStorageValue<TContext> {
  context: Partial<TContext>;
  version: string | number;
}

/** The envelope persisted to storage for event strategy. @public */
export interface PersistEventStorageValue<
  TEvent extends EventObject = EventObject
> {
  events: TEvent[];
  /**
   * Snapshot checkpoint from which to replay events. When events are truncated
   * by `maxEvents`, this stores the context at the truncation point so replay
   * produces the correct state.
   */
  checkpoint?: unknown;
  version: string | number;
}

/** Base options shared by both persist strategies. @public */
export interface PersistBaseOptions {
  /** Storage key (required). */
  name: string;
  /** Storage adapter. Defaults to `localStorage`. */
  storage?: StateStorage;
  /** Schema version. Defaults to 0. */
  version?: string | number;
  /** Minimum milliseconds between storage writes. Defaults to 0 (immediate). */
  throttle?: number;
  /** Called after a successful storage write. */
  onDone?: (data: any) => void;
  /** Called when a storage read or write fails. */
  onError?: (error: unknown) => void;
  /** Skip automatic hydration on store creation. Defaults to `false`. */
  skipHydration?: boolean;
}

/** Options for the snapshot persist strategy (default). @public */
export interface PersistSnapshotOptions<
  TContext = StoreContext,
  TEvent extends EventObject = EventObject
> extends PersistBaseOptions {
  /** Persist strategy. Defaults to `'snapshot'`. */
  strategy?: 'snapshot';
  /**
   * Controls whether an event should trigger a storage write. Return `false` to
   * skip persisting for that event.
   */
  filter?: (event: TEvent) => boolean;
  /** Select which parts of context to persist. Defaults to full context. */
  pick?: (context: TContext) => Partial<TContext>;
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
  /** Custom serializer. Defaults to `JSON.stringify`. */
  serialize?: (value: PersistStorageValue<TContext>) => string;
  /** Custom deserializer. Defaults to `JSON.parse`. */
  deserialize?: (str: string) => PersistStorageValue<TContext>;
}

/** Options for the event persist strategy. @public */
export interface PersistEventOptions<
  _TContext = StoreContext,
  TEvent extends EventObject = EventObject
> extends PersistBaseOptions {
  /** Persist strategy. */
  strategy: 'event';
  /**
   * Maximum number of events to keep. When exceeded, a snapshot checkpoint is
   * saved and oldest events are dropped. Replay starts from the checkpoint.
   * Defaults to Infinity.
   */
  maxEvents?: number;
  /** Migration function for version upgrades. Receives the stored events array. */
  migrate?: (persistedEvents: any[], version: string | number) => any[];
  /** Custom serializer. Defaults to `JSON.stringify`. */
  serialize?: (value: PersistEventStorageValue<TEvent>) => string;
  /** Custom deserializer. Defaults to `JSON.parse`. */
  deserialize?: (str: string) => PersistEventStorageValue<TEvent>;
}

/** Options for the `persist` store extension. @public */
export type PersistOptions<
  TContext = StoreContext,
  TEvent extends EventObject = EventObject
> =
  | PersistSnapshotOptions<TContext, TEvent>
  | PersistEventOptions<TContext, TEvent>;

// Internal helpers
const PERSIST_INTERNALS: unique symbol = Symbol.for('xstate-store-persist');

interface PersistInternals<TContext, TEvent extends EventObject = EventObject> {
  options: PersistOptions<TContext, TEvent>;
  storage: StateStorage;
  pendingContext: Partial<TContext> | null;
  pendingEvents: TEvent[] | null;
  pendingCheckpoint: unknown;
  flushTimeoutId: ReturnType<typeof setTimeout> | null;
  flush: () => void;
}

function getStorage(options: PersistOptions<any, any>): StateStorage {
  return options.storage ?? localStorage;
}

function isEventStrategy(
  options: PersistOptions<any, any>
): options is PersistEventOptions<any, any> {
  return options.strategy === 'event';
}

function serializeSnapshotValue<TContext>(
  options: PersistSnapshotOptions<TContext, any>,
  value: PersistStorageValue<TContext>
): string {
  return options.serialize ? options.serialize(value) : JSON.stringify(value);
}

function deserializeSnapshotValue<TContext>(
  options: PersistSnapshotOptions<TContext, any>,
  str: string
): PersistStorageValue<TContext> {
  return options.deserialize ? options.deserialize(str) : JSON.parse(str);
}

function serializeEventValue<TEvent extends EventObject>(
  options: PersistEventOptions<any, TEvent>,
  value: PersistEventStorageValue<TEvent>
): string {
  return options.serialize ? options.serialize(value) : JSON.stringify(value);
}

function deserializeEventValue<TEvent extends EventObject>(
  options: PersistEventOptions<any, TEvent>,
  str: string
): PersistEventStorageValue<TEvent> {
  return options.deserialize ? options.deserialize(str) : JSON.parse(str);
}

function mergeContext<TContext>(
  options: PersistSnapshotOptions<TContext, any>,
  persistedContext: Partial<TContext>,
  currentContext: TContext
): TContext {
  return options.merge
    ? options.merge(persistedContext, currentContext)
    : { ...currentContext, ...persistedContext };
}

function migrateSnapshotIfNeeded<TContext>(
  options: PersistSnapshotOptions<TContext, any>,
  stored: PersistStorageValue<TContext>
): Partial<TContext> {
  const currentVersion = options.version ?? 0;
  if (stored.version !== currentVersion && options.migrate) {
    return options.migrate(stored.context, stored.version) as Partial<TContext>;
  }
  return stored.context;
}

function migrateEventsIfNeeded<TEvent extends EventObject>(
  options: PersistEventOptions<any, TEvent>,
  stored: PersistEventStorageValue<TEvent>
): TEvent[] {
  const currentVersion = options.version ?? 0;
  if (stored.version !== currentVersion && options.migrate) {
    return options.migrate(stored.events, stored.version) as TEvent[];
  }
  return stored.events;
}

function writeSnapshotToStorage<TContext>(
  internals: PersistInternals<TContext>,
  context: TContext
): void {
  const options = internals.options as PersistSnapshotOptions<TContext, any>;
  const { storage } = internals;
  const contextToPersist = options.pick ? options.pick(context) : context;

  const value: PersistStorageValue<TContext> = {
    context: contextToPersist,
    version: options.version ?? 0
  };

  try {
    const serialized = serializeSnapshotValue(options, value);
    const result = storage.setItem(options.name, serialized);
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

function writeEventsToStorage<TEvent extends EventObject>(
  internals: PersistInternals<any, TEvent>,
  events: TEvent[],
  checkpoint?: unknown
): void {
  const options = internals.options as PersistEventOptions<any, TEvent>;
  const { storage } = internals;

  const value: PersistEventStorageValue<TEvent> = {
    events,
    version: options.version ?? 0
  };
  if (checkpoint !== undefined) {
    value.checkpoint = checkpoint;
  }

  try {
    const serialized = serializeEventValue(options, value);
    const result = storage.setItem(options.name, serialized);
    if (result instanceof Promise) {
      result
        .then(() => options.onDone?.(events))
        .catch((err) => options.onError?.(err));
    } else {
      options.onDone?.(events);
    }
  } catch (err) {
    options.onError?.(err);
  }
}

function createInternals<TContext, TEvent extends EventObject>(
  options: PersistOptions<TContext, TEvent>
): PersistInternals<TContext, TEvent> {
  const storage = getStorage(options);

  const internals: PersistInternals<TContext, TEvent> = {
    options,
    storage,
    pendingContext: null,
    pendingEvents: null,
    pendingCheckpoint: null,
    flushTimeoutId: null,
    flush: () => {
      if (internals.flushTimeoutId !== null) {
        clearTimeout(internals.flushTimeoutId);
        internals.flushTimeoutId = null;
      }
      if (isEventStrategy(options)) {
        if (internals.pendingEvents !== null) {
          writeEventsToStorage(
            internals,
            internals.pendingEvents,
            internals.pendingCheckpoint
          );
          internals.pendingEvents = null;
          internals.pendingCheckpoint = null;
        }
      } else {
        if (internals.pendingContext !== null) {
          writeSnapshotToStorage(
            internals as any,
            internals.pendingContext as TContext
          );
          internals.pendingContext = null;
        }
      }
    }
  };

  return internals;
}

// Core logic wrapper — snapshot strategy

function persistSnapshotFromLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  logic: StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>,
  options: PersistSnapshotOptions<TContext, TEvent>
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

        const parsed = deserializeSnapshotValue(options, storedValue);
        const persistedContext = migrateSnapshotIfNeeded(options, parsed);
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
          const parsed = deserializeSnapshotValue(options, rawState);
          const persistedContext = migrateSnapshotIfNeeded(options, parsed);
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
        writeSnapshotToStorage(internals as any, nextSnapshot.context);
      };

      return [snapshotWithMeta, [...effects, persistEffect]];
    }
  };

  return enhancedLogic;
}

// Core logic wrapper — event strategy

function persistEventFromLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  logic: StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>,
  options: PersistEventOptions<TContext, TEvent>
): StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted> {
  const internals = createInternals(options);
  const { storage } = internals;
  const throttleMs = options.throttle ?? 0;
  const maxEvents = options.maxEvents ?? Infinity;

  function replayEvents(baseSnapshot: any, events: TEvent[]): any {
    let current = baseSnapshot;
    for (const ev of events) {
      const [next] = logic.transition(current, ev);
      current = next;
    }
    return current;
  }

  const enhancedLogic: AnyStoreLogic = {
    getInitialSnapshot: () => {
      const baseSnapshot = logic.getInitialSnapshot();

      if (options.skipHydration) {
        return {
          ...baseSnapshot,
          _persistEvents: [],
          _persistCheckpoint: null,
          _persist: { hydrated: false },
          [PERSIST_INTERNALS]: internals
        };
      }

      // Attempt sync read
      try {
        const storedValue = storage.getItem(options.name);

        if (storedValue instanceof Promise) {
          return {
            ...baseSnapshot,
            _persistEvents: [],
            _persistCheckpoint: null,
            _persist: { hydrated: false },
            [PERSIST_INTERNALS]: internals
          };
        }

        if (storedValue === null) {
          return {
            ...baseSnapshot,
            _persistEvents: [],
            _persistCheckpoint: null,
            _persist: { hydrated: true },
            [PERSIST_INTERNALS]: internals
          };
        }

        const parsed = deserializeEventValue(options, storedValue);
        const events = migrateEventsIfNeeded(options, parsed);
        const checkpointSnapshot = parsed.checkpoint
          ? { ...baseSnapshot, context: parsed.checkpoint }
          : baseSnapshot;
        const replayedSnapshot = replayEvents(checkpointSnapshot, events);

        return {
          ...replayedSnapshot,
          _persistEvents: events,
          _persistCheckpoint: parsed.checkpoint ?? null,
          _persist: { hydrated: true },
          [PERSIST_INTERNALS]: internals
        };
      } catch (err) {
        options.onError?.(err);
        return {
          ...baseSnapshot,
          _persistEvents: [],
          _persistCheckpoint: null,
          _persist: { hydrated: true },
          [PERSIST_INTERNALS]: internals
        };
      }
    },

    transition: (snapshot, event) => {
      // Internal rehydrate event
      if (event.type === '__persist.rehydrate') {
        const rawState = event.state as string | null | undefined;

        if (!rawState) {
          return [
            {
              ...snapshot,
              _persistEvents: snapshot._persistEvents ?? [],
              _persistCheckpoint: snapshot._persistCheckpoint ?? null,
              _persist: { ...snapshot._persist, hydrated: true }
            },
            []
          ];
        }

        try {
          const parsed = deserializeEventValue(options, rawState);
          const events = migrateEventsIfNeeded(options, parsed);
          const baseSnapshot = logic.getInitialSnapshot();
          const checkpointSnapshot = parsed.checkpoint
            ? { ...baseSnapshot, context: parsed.checkpoint }
            : baseSnapshot;
          const replayedSnapshot = replayEvents(checkpointSnapshot, events);

          return [
            {
              ...replayedSnapshot,
              _persistEvents: events,
              _persistCheckpoint: parsed.checkpoint ?? null,
              _persist: { ...snapshot._persist, hydrated: true },
              [PERSIST_INTERNALS]: internals
            },
            []
          ];
        } catch (err) {
          options.onError?.(err);
          return [
            {
              ...snapshot,
              _persistEvents: snapshot._persistEvents ?? [],
              _persistCheckpoint: snapshot._persistCheckpoint ?? null,
              _persist: { ...snapshot._persist, hydrated: true }
            },
            []
          ];
        }
      }

      // Delegate to wrapped logic
      const [nextSnapshot, effects] = logic.transition(snapshot, event);
      const prevEvents: TEvent[] = snapshot._persistEvents ?? [];
      const prevCheckpoint: unknown = snapshot._persistCheckpoint ?? null;

      // Preserve metadata
      const snapshotWithMeta = {
        ...nextSnapshot,
        _persistEvents: prevEvents,
        _persistCheckpoint: prevCheckpoint,
        _persist: snapshot._persist ?? { hydrated: false },
        [PERSIST_INTERNALS]: internals
      };

      // Don't write to storage until hydrated
      if (!snapshotWithMeta._persist?.hydrated) {
        return [snapshotWithMeta, effects];
      }

      // Append event to persisted list
      let nextEvents = [...prevEvents, event as TEvent];
      let nextCheckpoint = prevCheckpoint;

      if (nextEvents.length > maxEvents) {
        // Compute checkpoint by replaying dropped events from previous checkpoint
        const droppedEvents = nextEvents.slice(0, -maxEvents);
        const baseSnapshot = logic.getInitialSnapshot();
        const checkpointBase = prevCheckpoint
          ? { ...baseSnapshot, context: prevCheckpoint }
          : baseSnapshot;
        const checkpointSnapshot = replayEvents(checkpointBase, droppedEvents);
        nextCheckpoint = checkpointSnapshot.context;
        nextEvents = nextEvents.slice(-maxEvents);
      }

      const snapshotWithEvents = {
        ...snapshotWithMeta,
        _persistEvents: nextEvents,
        _persistCheckpoint: nextCheckpoint
      };

      // Schedule storage write
      if (throttleMs > 0) {
        internals.pendingEvents = nextEvents;
        internals.pendingCheckpoint = nextCheckpoint;

        if (internals.flushTimeoutId === null) {
          const persistEffect = () => {
            internals.flushTimeoutId = setTimeout(() => {
              internals.flush();
            }, throttleMs);
          };
          return [snapshotWithEvents, [...effects, persistEffect]];
        }

        return [snapshotWithEvents, effects];
      }

      // Immediate write as effect
      const persistEffect = () => {
        writeEventsToStorage(internals, nextEvents, nextCheckpoint);
      };

      return [snapshotWithEvents, [...effects, persistEffect]];
    }
  };

  return enhancedLogic;
}

// Dispatch to the right strategy
function persistFromLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  logic: StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>,
  options: PersistOptions<TContext, TEvent>
): StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted> {
  if (isEventStrategy(options)) {
    return persistEventFromLogic(
      logic,
      options as PersistEventOptions<TContext, TEvent>
    );
  }
  return persistSnapshotFromLogic(
    logic,
    options as PersistSnapshotOptions<TContext, TEvent>
  );
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
  options: PersistOptions<NoInfer<TContext>>
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
        void storage.setItem(name, value);
      } catch {
        // Swallow write errors (quota exceeded, etc.)
      }
    },
    removeItem: (name) => {
      try {
        void storage.removeItem(name);
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
  void internals.storage.removeItem(internals.options.name);
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
 * Returns whether the store has been hydrated from storage.
 *
 * @example
 *
 * ```ts
 * import { isHydrated } from '@xstate/store/persist';
 *
 * if (isHydrated(store)) {
 *   // Safe to read persisted state
 * }
 * ```
 */
export function isHydrated(store: { getSnapshot: () => any }): boolean {
  return store.getSnapshot()?._persist?.hydrated === true;
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

/** Options for `createBroadcastStorage`. @public */
export interface BroadcastStorageOptions {
  /** Custom BroadcastChannel name. Defaults to `'xstate-store'`. */
  channel?: string;
}

/**
 * Wraps a `StateStorage` adapter so that `setItem` calls broadcast the update
 * to other tabs/windows via the `BroadcastChannel` API. Receiving tabs
 * automatically call `rehydrateStore()` on any stores registered with
 * `subscribeToBroadcastStorage()`.
 *
 * @example
 *
 * ```ts
 * import {
 *   persist,
 *   createJSONStorage,
 *   createBroadcastStorage,
 *   subscribeToBroadcastStorage
 * } from '@xstate/store/persist';
 *
 * const storage = createBroadcastStorage(
 *   createJSONStorage(() => localStorage)
 * );
 *
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(persist({ name: 'my-store', storage }));
 *
 * // Listen for updates from other tabs and rehydrate this store
 * const unsubscribe = subscribeToBroadcastStorage(store, { storage });
 *
 * // Clean up on page unload
 * window.addEventListener('beforeunload', unsubscribe);
 * ```
 */
export function createBroadcastStorage(
  baseStorage: StateStorage,
  options?: BroadcastStorageOptions
): StateStorage & { readonly channel: BroadcastChannel } {
  const channelName = options?.channel ?? 'xstate-store';
  const bc = new BroadcastChannel(channelName);

  return {
    channel: bc,
    getItem: (name) => baseStorage.getItem(name),
    setItem: (name, value) => {
      const result = baseStorage.setItem(name, value);
      // Broadcast after writing. For async storage, broadcast after the
      // write resolves so listeners read fresh data.
      if (result instanceof Promise) {
        return result.then(() => {
          bc.postMessage({ type: 'xstate-store-update', name });
        });
      }
      bc.postMessage({ type: 'xstate-store-update', name });
      return result;
    },
    removeItem: (name) => baseStorage.removeItem(name)
  };
}

/**
 * Subscribes a persisted store to cross-tab updates from a
 * `createBroadcastStorage` adapter. When another tab writes to the same storage
 * key the store will automatically rehydrate.
 *
 * Returns an `unsubscribe` function that closes the listener. Call it on page
 * unload or when the store is no longer needed.
 *
 * @example
 *
 * ```ts
 * const unsub = subscribeToBroadcastStorage(store, { storage });
 * // later…
 * unsub();
 * ```
 */
export function subscribeToBroadcastStorage(
  store: {
    getSnapshot: () => any;
    send: (event: any) => void;
  },
  options?: BroadcastStorageOptions
): () => void {
  const internals = store.getSnapshot()?.[PERSIST_INTERNALS] as
    | PersistInternals<any>
    | undefined;
  if (!internals) {
    throw new Error(
      'subscribeToBroadcastStorage: store does not have a persist extension'
    );
  }

  const channelName = options?.channel ?? 'xstate-store';
  const bc = new BroadcastChannel(channelName);
  const storeName = internals.options.name;

  const handler = (event: MessageEvent) => {
    const data = event.data;
    if (
      data &&
      data.type === 'xstate-store-update' &&
      data.name === storeName
    ) {
      // Re-read from storage and rehydrate
      void rehydrateStore(store);
    }
  };

  bc.addEventListener('message', handler);

  return () => {
    bc.removeEventListener('message', handler);
    bc.close();
  };
}
