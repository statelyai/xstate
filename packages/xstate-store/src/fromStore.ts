import { createStore, createStoreTransition } from './store';
import {
  EventPayloadMap,
  StoreContext,
  StoreSnapshot,
  Snapshot
} from './types';

/**
 * An actor logic creator which creates store [actor
 * logic](https://stately.ai/docs/actors#actor-logic) for use with XState.
 *
 * @param initialContext The initial context for the store, either a function
 *   that returns context based on input, or the context itself
 * @param transitions The transitions object defining how the context updates
 *   due to events
 * @returns An actor logic creator function that creates store actor logic
 */
export function fromStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TInput
>(
  initialContext: ((input: TInput) => TContext) | TContext,
  transitions: Parameters<typeof createStore<TContext, TEventPayloadMap>>[1]
) {
  const transition = createStoreTransition<TContext, TEventPayloadMap>(
    transitions
  );
  return {
    transition,
    start: () => {},
    getInitialSnapshot: (_: any, input: TInput) => {
      return {
        status: 'active',
        context:
          typeof initialContext === 'function'
            ? initialContext(input)
            : initialContext,
        output: undefined,
        error: undefined
      } satisfies StoreSnapshot<TContext>;
    },
    getPersistedSnapshot: (s: StoreSnapshot<TContext>) => s,
    restoreSnapshot: (s: Snapshot<unknown>) => s as StoreSnapshot<TContext>
  };
}
