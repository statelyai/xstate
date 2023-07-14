import {
  ActorLogic,
  ActorContext,
  ActorSystem,
  EventObject,
  ActorRefFrom
} from '../types';

export type TransitionActorLogic<
  TState,
  TEvent extends EventObject
> = ActorLogic<TEvent, TState, TState>;

export type TransitionActorRef<
  TState,
  TEvent extends EventObject
> = ActorRefFrom<TransitionActorLogic<TState, TEvent>>;

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
  TSystem extends ActorSystem<any>
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
        input: any;
        self: TransitionActorRef<TState, TEvent>;
      }) => TState) // TODO: type
): TransitionActorLogic<TState, TEvent> {
  const logic: ActorLogic<TEvent, TState, TState, TState> = {
    config: transition,
    transition: (state, event, actorContext) => {
      const nextState = transition(state, event as TEvent, actorContext as any);

      actorContext.self._parent?.send({
        type: `xstate.snapshot.${actorContext.id}`,
        data: nextState
      });

      return nextState;
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

  return logic;
}
