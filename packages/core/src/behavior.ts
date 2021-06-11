import { Behavior, EventObject } from '.';

/**
 * Returns an actor behavior from a reducer and its initial state.
 *
 * @param reducer The pure reducer that returns the next state given the current state and event.
 * @param initialState The initial state of the reducer.
 * @returns An actor behavior
 */
export function fromReducer<TState, TEvent extends EventObject>(
  reducer: (state: TState, event: TEvent) => TState,
  initialState: TState
): Behavior<TEvent, TState> {
  return {
    receive: reducer,
    initial: initialState
  };
}
