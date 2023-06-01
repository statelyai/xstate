import { ActorLogic, ActorContext, ActorSystem, EventObject } from '../types';

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
  initialState: TState | (({ input }: { input: any }) => TState) // TODO: type
): ActorLogic<TEvent, TState, TState> {
  const logic: ActorLogic<TEvent, TState, TState, TState> = {
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

  return logic;
}
