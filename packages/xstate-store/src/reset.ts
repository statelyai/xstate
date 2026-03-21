import {
  AnyStoreLogic,
  EventObject,
  EventPayloadMap,
  StoreContext,
  StoreExtension,
  StoreLogic,
  StoreSnapshot
} from './types';

interface ResetOptions<TContext extends StoreContext> {
  /**
   * Custom reset function. Receives the initial context and the current
   * context, returns the context to reset to.
   *
   * Defaults to returning the initial context (full reset).
   */
  to?: (initialContext: TContext, currentContext: TContext) => TContext;
}

function resetFromLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  logic: StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>,
  options?: ResetOptions<TContext>
): StoreLogic<StoreSnapshot<TContext>, TEvent | { type: 'reset' }, TEmitted> {
  const enhancedLogic: AnyStoreLogic = {
    getInitialSnapshot: () => logic.getInitialSnapshot(),
    transition: (snapshot, event) => {
      if (event.type === 'reset') {
        const initialSnapshot = logic.getInitialSnapshot();
        const resetContext = options?.to
          ? options.to(initialSnapshot.context, snapshot.context)
          : initialSnapshot.context;

        return [{ ...snapshot, context: resetContext }, []];
      }

      return logic.transition(snapshot, event);
    }
  };

  return enhancedLogic;
}

/**
 * Creates a store extension that adds a `reset` trigger to reset the store
 * context to its initial state.
 *
 * @example
 *
 * ```ts
 * import { reset } from '@xstate/store/reset';
 *
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(reset());
 *
 * store.trigger.inc();
 * store.trigger.reset(); // count = 0
 * ```
 *
 * @example
 *
 * ```ts
 * // Partial reset: keep some fields
 * const store = createStore({
 *   context: { count: 0, user: null as string | null },
 *   on: {
 *     inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
 *     login: (ctx, e: { user: string }) => ({ ...ctx, user: e.user })
 *   }
 * }).with(
 *   reset({
 *     to: (initial, current) => ({ ...initial, user: current.user })
 *   })
 * );
 *
 * store.trigger.reset(); // resets count, keeps user
 * ```
 */
export function reset<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  options?: ResetOptions<TContext>
): StoreExtension<TContext, TEventPayloadMap, { reset: null }, TEmitted> {
  return (logic: any) => resetFromLogic(logic, options);
}
