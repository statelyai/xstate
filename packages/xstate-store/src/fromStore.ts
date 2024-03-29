import { createStore, createStoreTransition } from '.';
import { EventPayloadMap, StoreContext, StoreSnapshot } from './types';

export function fromStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TInput
>(
  initialContext: ((input: TInput) => TContext) | TContext,
  transitions: Parameters<typeof createStore<TContext, TEventPayloadMap>>[1]
) {
  const transition = createStoreTransition(transitions);
  return {
    config: null as any, // TODO,
    transition,
    start: () => {},
    getInitialSnapshot: (_: any, input: TInput) => {
      return {
        status: 'active',
        context:
          typeof initialContext === 'function'
            ? initialContext(input)
            : initialContext
      } satisfies StoreSnapshot<TContext>;
    },
    getPersistedSnapshot: (s: StoreSnapshot<TContext>) => s,
    restoreSnapshot: (s: StoreSnapshot<TContext>) => s
  };
}
