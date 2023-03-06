import { EventObject } from 'xstate';
import { isMachine } from 'xstate/lib/utils';
import { getAdjacencyMap } from './adjacency';
import {
  SerializedState,
  SimpleBehavior,
  StatePath,
  Steps,
  TraversalOptions
} from './types';
import {
  resolveTraversalOptions,
  createDefaultMachineOptions,
  createDefaultBehaviorOptions
} from './graph';

export function getPathsFromEvents<
  TState,
  TEvent extends EventObject = EventObject
>(
  behavior: SimpleBehavior<TState, TEvent>,
  events: TEvent[],
  options?: TraversalOptions<TState, TEvent>
): Array<StatePath<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions<TState, TEvent>(
    {
      events,
      ...options
    },
    isMachine(behavior)
      ? createDefaultMachineOptions(behavior)
      : createDefaultBehaviorOptions(behavior)
  );
  const fromState = resolvedOptions.fromState ?? behavior.initialState;

  const { serializeState, serializeEvent } = resolvedOptions;

  const adjacency = getAdjacencyMap(behavior, resolvedOptions);

  const stateMap = new Map<SerializedState, TState>();
  const steps: Steps<TState, TEvent> = [];

  const serializedFromState = serializeState(
    fromState,
    undefined,
    undefined
  ) as SerializedState;
  stateMap.set(serializedFromState, fromState);

  let stateSerial = serializedFromState;
  let state = fromState;
  for (const event of events) {
    steps.push({
      state: stateMap.get(stateSerial)!,
      event
    });

    const eventSerial = serializeEvent(event);
    const { state: nextState, event: _nextEvent } =
      adjacency[stateSerial].transitions[eventSerial];

    if (!nextState) {
      throw new Error(
        `Invalid transition from ${stateSerial} with ${eventSerial}`
      );
    }
    const prevState = stateMap.get(stateSerial);
    const nextStateSerial = serializeState(
      nextState,
      event,
      prevState
    ) as SerializedState;
    stateMap.set(nextStateSerial, nextState);

    stateSerial = nextStateSerial;
    state = nextState;
  }

  // If it is expected to reach a specific state (`toState`) and that state
  // isn't reached, there are no paths
  if (resolvedOptions.toState && !resolvedOptions.toState(state)) {
    return [];
  }

  return [
    {
      state,
      steps,
      weight: steps.length
    }
  ];
}
