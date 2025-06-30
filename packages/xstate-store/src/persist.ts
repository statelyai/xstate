import { EventObject } from 'xstate';
import {
  StoreContext,
  EventPayloadMap,
  StoreConfig,
  ExtractEvents,
  StoreLogic,
  StoreSnapshot,
  EmitsFromStoreConfig,
  AnyStoreConfig,
  AnyStoreLogic
} from './types';
import { storeConfigToLogic } from './utils';

interface PersistOptions {
  /** The local storage key to use for persisting the store. */
  name: string;
  /** Custom serializer for storing/retrieving data from localStorage */
  serializer?: {
    serialize: (value: any) => string;
    deserialize: (value: string) => any;
  };
  /** Custom storage */
  storage?: Storage;
}

// Default serializer using JSON
const defaultSerializer = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
};

// Check if localStorage is available
function getLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.localStorage;
}

// Load persisted state from localStorage
function loadPersistedState<TContext extends StoreContext>(
  key: string,
  storage: Storage,
  serializer: PersistOptions['serializer'],
  fallbackContext: TContext
): TContext {
  if (!getLocalStorage()) {
    return fallbackContext;
  }

  try {
    const serialized = storage.getItem(key);
    if (!serialized) {
      return fallbackContext;
    }

    const { deserialize } = serializer || defaultSerializer;
    const persisted = deserialize(serialized);

    // Validate that the persisted data has the expected structure
    if (persisted && typeof persisted === 'object' && 'context' in persisted) {
      return persisted.context;
    }

    return fallbackContext;
  } catch (error) {
    console.warn(`Failed to load persisted state for key "${key}":`, error);
    return fallbackContext;
  }
}

// Save state to localStorage
function savePersistedState<TContext extends StoreContext>(
  key: string,
  snapshot: StoreSnapshot<TContext>,
  serializer: PersistOptions['serializer'],
  storage: Storage
): void {
  if (!getLocalStorage()) {
    return;
  }

  try {
    const { serialize } = serializer || defaultSerializer;
    const serialized = serialize(snapshot);
    storage.setItem(key, serialized);
  } catch (error) {
    console.warn(`Failed to save persisted state for key "${key}":`, error);
  }
}

export function persist<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap
>(
  storeConfig: StoreConfig<TContext, TEventPayloadMap, TEmittedPayloadMap>,
  options: PersistOptions
): StoreLogic<
  StoreSnapshot<TContext>,
  ExtractEvents<TEventPayloadMap>,
  EmitsFromStoreConfig<any>
>;
export function persist<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  storeLogic: StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>,
  options: PersistOptions
): StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>;
export function persist(
  storeConfigOrLogic: AnyStoreConfig | AnyStoreLogic,
  options: PersistOptions
): AnyStoreLogic {
  const resolvedStorage = options.storage ?? getLocalStorage();
  if (!resolvedStorage) {
    throw new Error('No storage provided');
  }
  const logic =
    'transition' in storeConfigOrLogic
      ? storeConfigOrLogic
      : storeConfigToLogic(storeConfigOrLogic);
  const initialContext = logic.getInitialSnapshot().context;
  const resolvedContext = resolvedStorage
    ? loadPersistedState(
        options.name,
        resolvedStorage,
        options.serializer,
        initialContext
      )
    : initialContext;

  const initialSnapshot = logic.getInitialSnapshot();

  logic.getInitialSnapshot = () => ({
    ...initialSnapshot,
    context: resolvedContext
  });

  // Load persisted state for initial snapshot
  const originalGetInitialSnapshot = logic.getInitialSnapshot;
  const persistedContext = loadPersistedState(
    options.name,
    resolvedStorage,
    options.serializer,
    originalGetInitialSnapshot().context
  );

  const getInitialSnapshot = () => ({
    ...originalGetInitialSnapshot(),
    context: persistedContext
  });

  // Wrap the transition to save state after each transition
  const originalTransition = logic.transition;
  const transition = (snapshot: any, event: any): [any, any[]] => {
    const [nextSnapshot, effects] = originalTransition(snapshot, event);

    const storage = options.storage ?? getLocalStorage();

    if (storage) {
      savePersistedState(
        options.name,
        nextSnapshot,
        options.serializer,
        storage
      );
    }

    return [nextSnapshot, effects];
  };

  return {
    getInitialSnapshot,
    transition
  };
}
