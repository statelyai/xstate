import {
  ActorLogic,
  ActorSystem,
  EventObject,
  InternalStateFrom,
  simulate
} from 'xstate';
import { SerializedEvent, SerializedState, TraversalOptions } from './types';
import { AdjacencyMap, resolveTraversalOptions } from './graph';

export function getAdjacencyMap<
  TEvent extends EventObject,
  TSnapshot,
  TInternalState = TSnapshot,
  TPersisted = TInternalState,
  TSystem extends ActorSystem<any> = ActorSystem<any>
>(
  logic: ActorLogic<TEvent, TSnapshot, TInternalState, TPersisted, TSystem>,
  options: TraversalOptions<TInternalState, TEvent>
): AdjacencyMap<TInternalState, TEvent> {
  const sim = simulate(logic);
  const {
    serializeEvent,
    serializeState,
    events: getEvents,
    traversalLimit: limit,
    fromState: customFromState,
    stopCondition
  } = resolveTraversalOptions(options);
  const fromState = customFromState ?? sim.getInitialState();
  const adj: AdjacencyMap<TInternalState, TEvent> = {};

  let iterations = 0;
  const queue: Array<{
    nextState: TInternalState;
    event: TEvent | undefined;
    prevState: TInternalState | undefined;
  }> = [{ nextState: fromState, event: undefined, prevState: undefined }];
  const stateMap = new Map<SerializedState, TInternalState>();

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
      const nextState = sim.transition(
        state as InternalStateFrom<typeof logic>,
        nextEvent
      );

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
