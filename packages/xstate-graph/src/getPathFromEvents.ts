import { EventObject } from 'xstate';
import {
  SerializedState,
  SimpleBehavior,
  StatePath,
  Steps,
  TraversalOptions
} from './types';
import {
  AdjacencyMap,
  defaultMachineStateOptions,
  getAdjacencyMap,
  resolveTraversalOptions
} from './graph';

export function getPathFromEvents<
  TState,
  TEvent extends EventObject = EventObject
>(
  behavior: SimpleBehavior<TState, TEvent>,
  events: TEvent[]
): StatePath<TState, TEvent> {
  const optionsWithDefaults = resolveTraversalOptions<TState, TEvent>(
    {
      getEvents: () => {
        return events;
      }
    },
    defaultMachineStateOptions as any
  );

  const adjacency = getAdjacencyMap(behavior, optionsWithDefaults);

  return baseGetPathFromEvents(
    adjacency,
    behavior.initialState,
    events,
    optionsWithDefaults
  );
}

export function baseGetPathFromEvents<TState, TEvent extends EventObject>(
  adjacencyMap: AdjacencyMap<TState, TEvent>,
  initialState: TState,
  events: TEvent[],
  options: Required<TraversalOptions<TState, TEvent>>
): StatePath<TState, TEvent> {
  const { serializeState, serializeEvent } = options;

  const stateMap = new Map<SerializedState, TState>();
  const path: Steps<TState, TEvent> = [];

  const initialSerializedState = serializeState(
    initialState,
    undefined,
    undefined
  ) as SerializedState;
  stateMap.set(initialSerializedState, initialState);

  let stateSerial = initialSerializedState;
  let state = initialState;
  for (const event of events) {
    path.push({
      state: stateMap.get(stateSerial)!,
      event
    });

    const eventSerial = serializeEvent(event);
    const { state: nextState, event: _nextEvent } = adjacencyMap[
      stateSerial
    ].transitions[eventSerial];

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

  return {
    state,
    steps: path,
    weight: path.length
  };
}
