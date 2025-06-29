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
import { createStoreTransition } from './store';

interface PersistOptions {
  /** The local storage key to use for persisting the store. */
  name: string;
  /** Custom serializer for storing/retrieving data from localStorage */
  serializer?: {
    serialize: (value: any) => string;
    deserialize: (value: string) => any;
  };
}

// Default serializer using JSON
const defaultSerializer = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
};

// Check if localStorage is available
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// Load persisted state from localStorage
function loadPersistedState<TContext extends StoreContext>(
  key: string,
  serializer: PersistOptions['serializer'],
  fallbackContext: TContext
): TContext {
  if (!isLocalStorageAvailable()) {
    return fallbackContext;
  }

  try {
    const serialized = localStorage.getItem(key);
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
  serializer: PersistOptions['serializer']
): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const { serialize } = serializer || defaultSerializer;
    const serialized = serialize(snapshot);
    localStorage.setItem(key, serialized);
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
  const logic =
    'transition' in storeConfigOrLogic
      ? storeConfigOrLogic
      : {
          getInitialSnapshot: () => ({
            status: 'active',
            context: storeConfigOrLogic.context,
            output: undefined,
            error: undefined
          }),
          transition: createStoreTransition(storeConfigOrLogic.on)
        };

  // Load persisted state for initial snapshot
  const originalGetInitialSnapshot = logic.getInitialSnapshot;
  const persistedContext = loadPersistedState(
    options.name,
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

    // Save the new state to localStorage
    savePersistedState(options.name, nextSnapshot, options.serializer);

    return [nextSnapshot, effects];
  };

  return {
    getInitialSnapshot,
    transition
  };
}
