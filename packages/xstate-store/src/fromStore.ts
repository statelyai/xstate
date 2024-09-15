import { ActorLogic, Cast } from 'xstate';
import { createStoreTransition, TransitionsFromEventPayloadMap } from './store';
import {
  EventPayloadMap,
  StoreContext,
  Snapshot,
  StoreSnapshot,
  EventObject,
  ExtractEventsFromPayloadMap,
  StoreAssigner,
  StorePropertyAssigner
} from './types';

type StoreLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject
> = ActorLogic<StoreSnapshot<TContext>, TEvent, TInput, any, TEmitted>;

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
    NoInfer<TContext>,
    EventObject
  >
): StoreLogic<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  TInput,
  EventObject
>;

/**
 * An actor logic creator which creates store [actor
 * logic](https://stately.ai/docs/actors#actor-logic) for use with XState.
 *
 * @param config An object containing the store configuration
 * @param config.context The initial context for the store, either a function
 *   that returns context based on input, or the context itself
 * @param config.on An object defining the transitions for different event types
 * @param config.types Optional object to define custom event types
 * @returns An actor logic creator function that creates store actor logic
 */
export function fromStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TInput,
  TTypes extends { emitted?: EventObject }
>(
  config: {
    context: ((input: TInput) => TContext) | TContext;
    on: {
      [K in keyof TEventPayloadMap & string]:
        | StoreAssigner<
            NoInfer<TContext>,
            { type: K } & TEventPayloadMap[K],
            Cast<TTypes['emitted'], EventObject>
          >
        | StorePropertyAssigner<
            NoInfer<TContext>,
            { type: K } & TEventPayloadMap[K],
            Cast<TTypes['emitted'], EventObject>
          >;
    };
  } & { types?: TTypes }
): StoreLogic<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  TInput,
  TTypes['emitted'] extends EventObject ? TTypes['emitted'] : EventObject
>;
export function fromStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TInput,
  TTypes extends { emitted?: EventObject }
>(
  initialContextOrObj:
    | ((input: TInput) => TContext)
    | TContext
    | ({
        context: ((input: TInput) => TContext) | TContext;
        on: {
          [K in keyof TEventPayloadMap & string]:
            | StoreAssigner<
                NoInfer<TContext>,
                { type: K } & TEventPayloadMap[K],
                Cast<TTypes['emitted'], EventObject>
              >
            | StorePropertyAssigner<
                NoInfer<TContext>,
                { type: K } & TEventPayloadMap[K],
                Cast<TTypes['emitted'], EventObject>
              >;
        };
      } & { types?: TTypes }),
  transitions?: TransitionsFromEventPayloadMap<
    TEventPayloadMap,
    NoInfer<TContext>,
    EventObject
  >
): StoreLogic<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  TInput,
  TTypes['emitted'] extends EventObject ? TTypes['emitted'] : EventObject
> {
  let initialContext: ((input: TInput) => TContext) | TContext;
  let transitionsObj: TransitionsFromEventPayloadMap<
    TEventPayloadMap,
    NoInfer<TContext>,
    EventObject
  >;

  if (
    typeof initialContextOrObj === 'object' &&
    'context' in initialContextOrObj
  ) {
    initialContext = initialContextOrObj.context;
    transitionsObj = initialContextOrObj.on;
  } else {
    initialContext = initialContextOrObj;
    transitionsObj = transitions!;
  }

  const transition = createStoreTransition(transitionsObj);
  return {
    transition: (snapshot, event, actorScope) => {
      const [nextSnapshot, emittedEvents] = transition(snapshot, event);

      emittedEvents.forEach(actorScope.emit);

      return nextSnapshot;
    },
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
