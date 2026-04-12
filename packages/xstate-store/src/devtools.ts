import { AnyStoreLogic, StoreExtension } from './types';

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
  unsubscribe(): void;
  error(message: string): void;
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

function getExtension(): ReduxDevtoolsExtension | undefined {
  if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
    return window.__REDUX_DEVTOOLS_EXTENSION__;
  }
  return undefined;
}

/**
 * Creates a store extension that connects the store to [Redux
 * DevTools](https://github.com/reduxjs/redux-devtools) for action logging,
 * state inspection, and state diffing.
 *
 * This is a one-way connection: actions and state are sent to devtools, but
 * time-travel controls (jump, reset, rollback) are not wired up.
 *
 * @example
 *
 * ```ts
 * import { devtools } from '@xstate/store/devtools';
 *
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(devtools({ name: 'Counter' }));
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
 */
export function devtools(
  options?: DevtoolsOptions
): StoreExtension<any, any, {}, any> {
  const opts = options ?? {};
  const extensionApi = getExtension();

  // If devtools not available or disabled, return identity extension
  if (!extensionApi || opts.enabled === false) {
    return (logic: any) => logic;
  }

  const name = opts.name ?? '@xstate/store';
  const sanitizeState = opts.stateSanitizer ?? ((s: any) => s);
  const sanitizeAction = opts.actionSanitizer ?? ((a: any) => a);

  const connection = extensionApi.connect({
    name,
    maxAge: opts.maxAge ?? 50,
    features: {
      pause: true,
      lock: false,
      persist: false,
      export: true,
      import: false,
      jump: false,
      skip: false,
      reorder: false,
      dispatch: false,
      test: false
    }
  }) as ReduxDevtoolsConnection;

  return (logic: AnyStoreLogic): AnyStoreLogic => ({
    getInitialSnapshot: () => {
      const snapshot = logic.getInitialSnapshot();
      connection.init(sanitizeState(snapshot.context));
      return snapshot;
    },

    transition: (snapshot, event) => {
      const [nextSnapshot, effects] = logic.transition(snapshot, event);

      // Send to devtools as an effect (after state is committed)
      const devtoolsEffect = () => {
        connection.send(
          sanitizeAction(event),
          sanitizeState(nextSnapshot.context)
        );
      };

      return [nextSnapshot, [...effects, devtoolsEffect]];
    }
  });
}
