import {
  ActorLogic,
  ActorContext,
  ActorSystem,
  EventObject,
  ActorRefFrom,
  AnyActorSystem
} from '../types';

export type TransitionActorLogic<
  TSnapshot,
  TEvent extends EventObject,
  TInput
> = ActorLogic<
  TSnapshot,
  TEvent,
  TInput,
  unknown,
  TSnapshot,
  TSnapshot,
  AnyActorSystem
>;

export type TransitionActorRef<
  TState,
  TEvent extends EventObject
> = ActorRefFrom<TransitionActorLogic<TState, TEvent, unknown>>;

/**
 * Returns actor logic from a transition function and its initial state.
 *
 * A transition function is a function that takes the current state and an event and returns the next state.
 *
 * @param transition The transition function that returns the next state given the current state and event.
 * @param initialState The initial state of the transition function.
 * @returns Actor logic
 */
export function fromTransition<
  TState,
  TEvent extends EventObject,
  TSystem extends ActorSystem<any>,
  TInput
>(
  transition: (
    state: TState,
    event: TEvent,
    actorContext: ActorContext<TEvent, TState, TSystem>
  ) => TState,
  initialState:
    | TState
    | (({
        input,
        self
      }: {
        input: TInput;
        self: TransitionActorRef<TState, TEvent>;
      }) => TState) // TODO: type
): TransitionActorLogic<TState, TEvent, TInput> {
  return {
    config: transition,
    transition: (state, event, actorContext) => {
      return transition(state, event as TEvent, actorContext as any);
    },
    getInitialState: (_, input) => {
      return typeof initialState === 'function'
        ? (initialState as any)({ input })
        : initialState;
    },
    getSnapshot: (state) => state,
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };
}
