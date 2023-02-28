import { EventObject } from 'xstate';
import {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  TraversalOptions
} from './types';
import { AdjacencyMap, resolveTraversalOptions } from './graph';

export function getAdjacencyMap<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): AdjacencyMap<TState, TEvent> {
  const { transition } = behavior;
  const {
    serializeEvent,
    serializeState,
    events: getEvents,
    traversalLimit: limit,
    fromState: customFromState,
    stopCondition
  } = resolveTraversalOptions(options);
  const fromState = customFromState ?? behavior.initialState;
  const adj: AdjacencyMap<TState, TEvent> = {};

  let iterations = 0;
  const queue: Array<{
    nextState: TState;
    event: TEvent | undefined;
    prevState: TState | undefined;
  }> = [{ nextState: fromState, event: undefined, prevState: undefined }];
  const stateMap = new Map<SerializedState, TState>();

  while (queue.length) {
    const { nextState: state, event, prevState } = queue.shift()!;

    if (iterations++ > limit) {
      throw new Error('Traversal limit exceeded');
    }

    const serializedState = serializeState(
      state,
      event,
      prevState
    ) as SerializedState;
    if (adj[serializedState]) {
      continue;
    }
    stateMap.set(serializedState, state);

    adj[serializedState] = {
      state,
      transitions: {}
    };

    if (stopCondition && stopCondition(state)) {
      continue;
    }

    const events =
      typeof getEvents === 'function' ? getEvents(state) : getEvents;

    for (const nextEvent of events) {
      const nextState = transition(state, nextEvent);

      if (!options.filter || options.filter(nextState, nextEvent)) {
        adj[serializedState].transitions[
          serializeEvent(nextEvent) as SerializedEvent
        ] = {
          event: nextEvent,
          state: nextState
        };
        queue.push({ nextState, event: nextEvent, prevState: state });
      }
    }
  }

  return adj;
}
