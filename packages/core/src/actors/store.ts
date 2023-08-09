import {
  ActorLogic,
  ActorContext,
  ActorSystem,
  EventObject,
  ActorRefFrom,
  AnyActorSystem
} from '../types';

export type StoreActorLogic<
  TState,
  TEvent extends EventObject,
  TInput
> = ActorLogic<TEvent, TState, TState, TState, AnyActorSystem, TInput>;

export type TransitionActorRef<
  TState,
  TEvent extends EventObject
> = ActorRefFrom<StoreActorLogic<TState, TEvent, unknown>>;

export type NotAFunction<T> = T extends (...args: any[]) => any ? never : T;

/**
 * Returns actor logic from a transition function and its initial state.
 *
 * A transition function is a function that takes the current state and an event and returns the next state.
 *
 * @param transition The transition function that returns the next state given the current state and event.
 * @param initialState The initial state of the transition function.
 * @returns Actor logic
 */
export function fromStore<
  TState extends Record<string, any>,
  TEvent extends EventObject,
  TSystem extends ActorSystem<any>,
  TInput
>(
  storeCreator: TState | (({ input }: { input: TInput }) => TState),
  methods: Record<
    string,
    (
      state: TState,
      event: TEvent,
      actorContext: ActorContext<TEvent, TState, TSystem>
    ) => Partial<TState>
  >
): StoreActorLogic<TState, TEvent, TInput> {
  return {
    config: storeCreator,
    transition: (state, event, actorContext) => {
      const method = methods[event.type];

      if (typeof method === 'function') {
        const result = method(state, event, actorContext as any);
        return {
          ...state,
          ...result
        };
      }

      return state;
    },
    getInitialState: (_, input) => {
      return typeof storeCreator === 'function'
        ? (storeCreator as any)({ input })
        : storeCreator;
    },
    getSnapshot: (state) => state,
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };
}
