import { ActorBehavior, ActorContext, EventObject } from '../types';
import { isSCXMLEvent } from '../utils';

/**
 * Returns an actor behavior from a reducer and its initial state.
 *
 * @param transition The pure reducer that returns the next state given the current state and event.
 * @param initialState The initial state of the reducer.
 * @returns An actor behavior
 */

export function fromReducer<TState, TEvent extends EventObject>(
  transition: (
    state: TState,
    event: TEvent,
    actorContext: ActorContext<TEvent, TState>
  ) => TState,
  initialState: TState | ((actorCtx: ActorContext<TEvent, TState>) => TState) // TODO: type
): ActorBehavior<TEvent, TState, TState> {
  const behavior: ActorBehavior<TEvent, TState, TState, TState> = {
    transition: (state, event, actorCtx) => {
      // @ts-ignore TODO
      const resolvedEvent = isSCXMLEvent(event) ? event.data : event;
      // @ts-ignore TODO
      return transition(state, resolvedEvent, actorCtx);
    },
    getInitialState:
      typeof initialState === 'function' ? initialState : () => initialState,
    getSnapshot: (state) => state,
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };

  return behavior;
}
