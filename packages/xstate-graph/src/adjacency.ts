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
  const { transition, initialState } = behavior;
  const {
    serializeEvent,
    serializeState,
    getEvents,
    eventCases,
    traversalLimit
  } = resolveTraversalOptions(options);
  const adj: AdjacencyMap<TState, TEvent> = {};

  let iterations = 0;
  const queue: Array<
    [
      nextState: TState,
      event: TEvent | undefined,
      prevState: TState | undefined
    ]
  > = [[initialState, undefined, undefined]];
  const stateMap = new Map<SerializedState, TState>();

  while (queue.length) {
    const [state, event, prevState] = queue.shift()!;

    if (iterations++ > traversalLimit) {
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

    const events = getEvents(state, eventCases);

    for (const subEvent of events) {
      const nextState = transition(state, subEvent);

      if (!options.filter || options.filter(nextState, subEvent)) {
        adj[serializedState].transitions[
          serializeEvent(subEvent) as SerializedEvent
        ] = {
          event: subEvent,
          state: nextState
        };
        queue.push([nextState, subEvent, state]);
      }
    }
  }

  return adj;
}
