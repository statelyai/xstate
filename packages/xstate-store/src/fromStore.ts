import { ActorLogic } from 'xstate';
import { createStoreTransition, computeGetters } from './store';
import {
  EventPayloadMap,
  StoreContext,
  StoreSnapshot,
  EventObject,
  ExtractEvents,
  StoreAssigner,
  StoreGetters
} from './types';

type StoreLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject,
  TGetters extends Record<string, (context: TContext, getters: any) => any> = {}
> = ActorLogic<
  StoreSnapshot<TContext, TGetters>,
  TEvent,
  TInput,
  any,
  TEmitted
>;

/**
 * An actor logic creator which creates store [actor
 * logic](https://stately.ai/docs/actors#actor-logic) for use with XState.
 *
 * @param config An object containing the store configuration
 * @param config.context The initial context for the store, either a function
 *   that returns context based on input, or the context itself
 * @param config.on An object defining the transitions for different event types
 * @param config.emits Optional object to define emitted event handlers
 * @param config.getters Optional object to define store getters
 * @returns An actor logic creator function that creates store actor logic
 */
export function fromStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TInput,
  TEmitted extends EventPayloadMap,
  TGetters extends Record<string, (context: TContext, getters: any) => any> = {}
>(config: {
  context: ((input: TInput) => TContext) | TContext;
  on: {
    [K in keyof TEventPayloadMap & string]: StoreAssigner<
      NoInfer<TContext>,
      { type: K } & TEventPayloadMap[K],
      ExtractEvents<TEmitted>
    >;
  };
  emits?: {
    [K in keyof TEmitted & string]: (
      payload: { type: K } & TEmitted[K]
    ) => void;
  };
  getters?: StoreGetters<TContext, TGetters>;
}): StoreLogic<
  TContext,
  ExtractEvents<TEventPayloadMap>,
  TInput,
  ExtractEvents<TEmitted>,
  TGetters
> {
  const initialContext = config.context;
  const transitionsObj = config.on;
  const getters = config.getters;

  const transition = createStoreTransition(transitionsObj);

  return {
    transition: (snapshot, event, actorScope) => {
      const [newContext, effects] = transition(snapshot.context, event);

      const newSnapshot = {
        ...snapshot,
        context: newContext,
        ...computeGetters(newContext, getters)
      } as StoreSnapshot<TContext, TGetters>;

      for (const effect of effects) {
        if (typeof effect === 'function') {
          effect();
        } else {
          actorScope.emit(effect);
        }
      }

      return newSnapshot;
    },
    getInitialSnapshot: (_, input: TInput) => {
      const context =
        typeof initialContext === 'function'
          ? initialContext(input)
          : initialContext;

      return {
        status: 'active',
        context,
        output: undefined,
        error: undefined,
        ...computeGetters(context, getters)
      } satisfies StoreSnapshot<TContext, TGetters>;
    },
    getPersistedSnapshot: (s) => s,
    restoreSnapshot: (s) => s as StoreSnapshot<TContext, TGetters>
  };
}
