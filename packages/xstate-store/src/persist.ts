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

interface PersistOptions<T> {
  /** The local storage key to use for persisting the store. */
  name: string;
  /** Custom serialization for storing/retrieving data from localStorage */
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
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
  deserialize: PersistOptions<any>['deserialize'],
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

    const resolvedDeserialize = deserialize ?? defaultSerializer.deserialize;

    const persisted = resolvedDeserialize(serialized);

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
  serialize: PersistOptions<any>['serialize']
): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const resolvedSerialize = serialize ?? defaultSerializer.serialize;
    const serialized = resolvedSerialize(snapshot);
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
  options: PersistOptions<TContext>
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
  options: PersistOptions<TContext>
): StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>;
export function persist(
  storeConfigOrLogic: AnyStoreConfig | AnyStoreLogic,
  options: PersistOptions<any>
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
    options.deserialize,
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
    savePersistedState(options.name, nextSnapshot, options.serialize);

    return [nextSnapshot, effects];
  };

  return {
    getInitialSnapshot,
    transition
  };
}
