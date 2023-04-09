import {
  ActorBehavior,
  ActorContext,
  ActorSystem,
  EventObject
} from '../types';
import { isSCXMLEvent } from '../utils';

/**
 * Returns an actor behavior from a transition function and its initial state.
 *
 * A transition function is a function that takes the current state and an event and returns the next state.
 *
 * @param transition The transition function that returns the next state given the current state and event.
 * @param initialState The initial state of the transition function.
 * @returns An actor behavior
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
): ActorBehavior<TEvent, TState, TState> {
  const behavior: ActorBehavior<TEvent, TState, TState, TState> = {
    transition: (state, event, actorContext) => {
      // @ts-ignore TODO
      const resolvedEvent = isSCXMLEvent(event) ? event.data : event;
      // @ts-ignore TODO
      return transition(state, resolvedEvent, actorContext);
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

  return behavior;
}
