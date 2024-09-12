import { ActorLogic } from 'xstate';
import { createStoreTransition, TransitionsFromEventPayloadMap } from './store';
import {
  EventPayloadMap,
  StoreContext,
  Snapshot,
  StoreSnapshot,
  EventObject,
  ExtractEventsFromPayloadMap
} from './types';

type StoreLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TInput
> = ActorLogic<StoreSnapshot<TContext>, TEvent, TInput, any, any>;

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
  transitions: TransitionsFromEventPayloadMap<
    TEventPayloadMap,
    TContext,
    EventObject
  >
): StoreLogic<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TInput> {
  const transition = createStoreTransition(transitions);
  return {
    transition,
    getInitialSnapshot: (_, input: TInput) => {
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
