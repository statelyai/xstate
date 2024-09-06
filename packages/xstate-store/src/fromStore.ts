import { EventObject } from 'xstate';
import {
  createStore,
  createStoreTransition,
  EmittedFromSchemas,
  TransitionsFromEventPayloadMap
} from './store';
import {
  EventPayloadMap,
  StoreContext,
  // StoreSnapshot,
  Snapshot,
  ExtractEventsFromPayloadMap,
  StoreSnapshot
} from './types';

type StoreLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TInput
> = {
  transition: (context: TContext, event: TEvent) => TContext;
  start: () => void;
  getInitialSnapshot: (_: any, input: TInput) => StoreSnapshot<TContext>;
  getPersistedSnapshot: (
    snapshot: StoreSnapshot<TContext>
  ) => StoreSnapshot<TContext>;
  restoreSnapshot: (snapshot: Snapshot<unknown>) => StoreSnapshot<TContext>;
};

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
  TInput,
  TSchemas extends { emitted: Record<string, { _output: unknown }> }
>({
  context,
  on,
  schemas
}: {
  context: ((input: TInput) => TContext) | TContext;
  on: TransitionsFromEventPayloadMap<
    TEventPayloadMap,
    TContext,
    EmittedFromSchemas<TSchemas['emitted']>
  >;
} & { schemas?: TSchemas }): StoreLogic<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  TInput
>;
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
): StoreLogic<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TInput>;
export function fromStore(
  initialContextOrObject: any,
  transitions?: any
): StoreLogic<any, any, any> {
  let [initialContext, actualTransitions] =
    transitions === undefined
      ? [initialContextOrObject.context, initialContextOrObject.on]
      : [initialContextOrObject, transitions];

  const transition = createStoreTransition(transitions);
  return {
    transition,
    start: () => {},
    getInitialSnapshot: (_: any, input: any /* TInput */) => {
      return {
        status: 'active',
        context:
          typeof initialContext === 'function'
            ? initialContext(input)
            : initialContext,
        output: undefined,
        error: undefined
      }; /* satisfies StoreSnapshot<TContext>; */
    },
    getPersistedSnapshot: (s: any /*StoreSnapshot<TContext>*/) => s,
    restoreSnapshot: (s: Snapshot<unknown>) => s as StoreSnapshot<any>
  };
}
