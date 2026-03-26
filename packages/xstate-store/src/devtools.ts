import {
  AnyStoreLogic,
  EventObject,
  EventPayloadMap,
  StoreContext,
  StoreExtension,
  StoreLogic,
  StoreSnapshot
} from './types';

/** Options for the `devtools` store extension. */
export interface DevtoolsOptions {
  /** Instance name shown in Redux DevTools. Defaults to `'@xstate/store'`. */
  name?: string;
  /** Maximum number of actions stored. Defaults to 50. */
  maxAge?: number;
  /** Enable/disable the devtools connection. Defaults to `true`. */
  enabled?: boolean;
  /**
   * Transform the state before sending to devtools. Useful for removing
   * non-serializable or internal properties.
   */
  stateSanitizer?: (state: any) => any;
  /**
   * Transform the action/event before sending to devtools. Useful for redacting
   * sensitive payloads.
   */
  actionSanitizer?: (action: any) => any;
}

// Redux DevTools Extension types (minimal, based on actual runtime API)
interface ReduxDevtoolsConnection {
  init(state: unknown): void;
  send(action: { type: string; [k: string]: unknown }, state: unknown): void;
  subscribe(
    listener: (message: ReduxDevtoolsMessage) => void
  ): (() => void) | undefined;
  unsubscribe(): void;
  error(message: string): void;
}

interface ReduxDevtoolsMessage {
  type: string;
  payload?: any;
  state?: string;
}

interface ReduxDevtoolsExtension {
  connect(options?: {
    name?: string;
    maxAge?: number;
    features?: Record<string, boolean>;
  }): ReduxDevtoolsConnection;
}

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension;
  }
}

const DEVTOOLS_INTERNALS: unique symbol = Symbol.for('xstate-store-devtools');

interface DevtoolsInternals {
  connection: ReduxDevtoolsConnection;
  /** When true, suppress sending state changes back to devtools. */
  isTimeTraveling: boolean;
  /** Set by connectDevtools() — needed for time-travel. */
  send: ((event: any) => void) | null;
  unsubDevtools: (() => void) | undefined;
  initialContext: any;
  sanitizeState: (state: any) => any;
}

function getExtension(): ReduxDevtoolsExtension | undefined {
  if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
    return window.__REDUX_DEVTOOLS_EXTENSION__;
  }
  return undefined;
}

function devtoolsFromLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  logic: StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>,
  options: DevtoolsOptions
): StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted> {
  const extension = getExtension();

  // If devtools not available or disabled, return logic unchanged
  if (!extension || options.enabled === false) {
    return logic;
  }

  const name = options.name ?? '@xstate/store';
  const sanitizeState = options.stateSanitizer ?? ((s: any) => s);
  const sanitizeAction = options.actionSanitizer ?? ((a: any) => a);

  const connection = extension.connect({
    name,
    maxAge: options.maxAge ?? 50,
    features: {
      pause: true,
      lock: false,
      persist: false,
      export: true,
      import: true,
      jump: true,
      skip: false,
      reorder: false,
      dispatch: true,
      test: false
    }
  }) as ReduxDevtoolsConnection;

  const internals: DevtoolsInternals = {
    connection,
    isTimeTraveling: false,
    send: null,
    unsubDevtools: undefined,
    initialContext: undefined,
    sanitizeState
  };

  const enhancedLogic: AnyStoreLogic = {
    getInitialSnapshot: () => {
      const snapshot = logic.getInitialSnapshot();
      internals.initialContext = snapshot.context;

      // Init devtools with initial state
      connection.init(sanitizeState(snapshot.context));

      return {
        ...snapshot,
        [DEVTOOLS_INTERNALS]: internals
      };
    },

    transition: (snapshot, event) => {
      // Internal event from devtools time-travel
      if (event.type === '__devtools.setState') {
        const newContext = (event as any).context;
        return [
          {
            ...snapshot,
            context: newContext,
            [DEVTOOLS_INTERNALS]: internals
          },
          []
        ];
      }

      // Normal transition — skip recording if time-traveling
      const [nextSnapshot, effects] = logic.transition(snapshot, event);

      const snapshotWithMeta = {
        ...nextSnapshot,
        [DEVTOOLS_INTERNALS]: internals
      };

      if (internals.isTimeTraveling) {
        return [snapshotWithMeta, effects];
      }

      // Send to devtools as an effect (after state is committed)
      const devtoolsEffect = () => {
        connection.send(
          sanitizeAction(event),
          sanitizeState(nextSnapshot.context)
        );
      };

      return [snapshotWithMeta, [...effects, devtoolsEffect]];
    }
  };

  return enhancedLogic;
}

/**
 * Creates a store extension that connects the store to [Redux
 * DevTools](https://github.com/reduxjs/redux-devtools).
 *
 * Enables action logging, state inspection, and state diffing in the Redux
 * DevTools browser extension.
 *
 * For time-travel support (jump, reset, rollback), call
 * `connectDevtools(store)` after creating the store.
 *
 * @example
 *
 * ```ts
 * import { devtools, connectDevtools } from '@xstate/store/devtools';
 *
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(devtools({ name: 'Counter' }));
 *
 * // Enable time-travel (optional)
 * connectDevtools(store);
 * ```
 *
 * @example
 *
 * ```ts
 * // With state sanitizer (remove internal properties)
 * const store = createStore({
 *   context: { count: 0, _internal: 'hidden' },
 *   on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
 * }).with(
 *   devtools({
 *     name: 'Counter',
 *     stateSanitizer: ({ _internal, ...rest }) => rest
 *   })
 * );
 * ```
 *
 * @example
 *
 * ```ts
 * // Composing with other extensions
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * })
 *   .with(undoRedo())
 *   .with(devtools({ name: 'Counter' }));
 *
 * connectDevtools(store);
 * ```
 */
export function devtools<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  options?: DevtoolsOptions
): StoreExtension<TContext, TEventPayloadMap, {}, TEmitted> {
  return (logic: any) => devtoolsFromLogic(logic, options ?? {});
}

/**
 * Connects the store to Redux DevTools for time-travel support. Call this after
 * creating the store to enable jump-to-state, reset, rollback, and import
 * features.
 *
 * Without calling this, the devtools extension still logs actions and state —
 * but time-travel controls won't work.
 *
 * @example
 *
 * ```ts
 * import { devtools, connectDevtools } from '@xstate/store/devtools';
 *
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(devtools({ name: 'Counter' }));
 *
 * const cleanup = connectDevtools(store);
 *
 * // Later, to disconnect:
 * cleanup();
 * ```
 *
 * @returns A cleanup function that disconnects from devtools.
 */
export function connectDevtools(store: {
  getSnapshot: () => any;
  send: (event: any) => void;
}): () => void {
  const internals = store.getSnapshot()?.[DEVTOOLS_INTERNALS] as
    | DevtoolsInternals
    | undefined;
  if (!internals) {
    // Devtools extension not available or not enabled — noop
    return () => {};
  }

  const { connection, sanitizeState } = internals;
  internals.send = store.send;

  const unsub = connection.subscribe((message) => {
    if (message.type === 'ACTION') {
      // Custom action dispatched from devtools Dispatcher panel
      if (typeof message.payload === 'string') {
        try {
          const action = JSON.parse(message.payload);
          if (action?.type) {
            store.send(action);
          }
        } catch {
          // Invalid JSON
        }
      }
      return;
    }

    if (message.type !== 'DISPATCH') {
      return;
    }

    switch (message.payload?.type) {
      case 'JUMP_TO_STATE':
      case 'JUMP_TO_ACTION': {
        if (message.state) {
          try {
            const context = JSON.parse(message.state);
            internals.isTimeTraveling = true;
            store.send({ type: '__devtools.setState', context });
            internals.isTimeTraveling = false;
          } catch {
            // Invalid state from devtools
          }
        }
        break;
      }

      case 'RESET': {
        internals.isTimeTraveling = true;
        store.send({
          type: '__devtools.setState',
          context: internals.initialContext
        });
        connection.init(sanitizeState(internals.initialContext));
        internals.isTimeTraveling = false;
        break;
      }

      case 'COMMIT': {
        const current = store.getSnapshot()?.context;
        connection.init(sanitizeState(current));
        break;
      }

      case 'ROLLBACK': {
        if (message.state) {
          try {
            const context = JSON.parse(message.state);
            internals.isTimeTraveling = true;
            store.send({ type: '__devtools.setState', context });
            connection.init(sanitizeState(context));
            internals.isTimeTraveling = false;
          } catch {
            // Invalid state
          }
        }
        break;
      }

      case 'IMPORT_STATE': {
        const { nextLiftedState } = message.payload;
        const computedStates = nextLiftedState?.computedStates;
        if (computedStates?.length) {
          const lastState = computedStates[computedStates.length - 1]?.state;
          if (lastState !== undefined) {
            internals.isTimeTraveling = true;
            store.send({ type: '__devtools.setState', context: lastState });
            connection.send(null as any, nextLiftedState);
            internals.isTimeTraveling = false;
          }
        }
        break;
      }

      case 'PAUSE_RECORDING':
        // Handled by the extension itself
        break;
    }
  });
  internals.unsubDevtools = unsub ?? undefined;

  return () => {
    unsub?.();
    connection.unsubscribe();
    internals.send = null;
  };
}

/**
 * Disconnects the store from Redux DevTools.
 *
 * @example
 *
 * ```ts
 * import { disconnectDevtools } from '@xstate/store/devtools';
 *
 * disconnectDevtools(store);
 * ```
 */
export function disconnectDevtools(store: { getSnapshot: () => any }): void {
  const internals = store.getSnapshot()?.[DEVTOOLS_INTERNALS] as
    | DevtoolsInternals
    | undefined;
  if (!internals) {
    return;
  }
  internals.unsubDevtools?.();
  internals.connection.unsubscribe();
  internals.send = null;
}
