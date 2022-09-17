import { EventObject, AnyStateMachine, StateFrom, EventFrom } from 'xstate';
import {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePlan,
  StatePlanMap,
  TraversalOptions
} from './types';
import {
  resolveTraversalOptions,
  defaultMachineStateOptions,
  getAdjacencyMap,
  AdjacencyMap
} from './graph';

export function getMachineShortestPlans<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: Partial<TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>>
): Array<StatePlan<StateFrom<TMachine>, EventFrom<TMachine>>> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    defaultMachineStateOptions
  );
  return getShortestPlans(
    {
      transition: (state, event) => machine.transition(state, event),
      initialState: machine.initialState
    },
    resolvedOptions
  ) as Array<StatePlan<StateFrom<TMachine>, EventFrom<TMachine>>>;
}

export function getShortestPlans<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options?: Partial<TraversalOptions<TState, TEvent>>
): Array<StatePlan<TState, TEvent>> {
  const optionsWithDefaults = resolveTraversalOptions(options);

  const adjacency = getAdjacencyMap(behavior, optionsWithDefaults);

  return baseGetShortestPlans(
    adjacency,
    behavior.initialState,
    optionsWithDefaults
  );
}

export function baseGetShortestPlans<TState, TEvent extends EventObject>(
  adjacencyMap: AdjacencyMap<TState, TEvent>,
  initialState: TState,
  options: Partial<TraversalOptions<TState, TEvent>>
): Array<StatePlan<TState, TEvent>> {
  const optionsWithDefaults = resolveTraversalOptions(options);

  const serializeState = optionsWithDefaults.serializeState as (
    ...args: Parameters<typeof optionsWithDefaults.serializeState>
  ) => SerializedState;

  // weight, state, event
  const weightMap = new Map<
    SerializedState,
    [
      weight: number,
      state: SerializedState | undefined,
      event: TEvent | undefined
    ]
  >();
  const stateMap = new Map<SerializedState, TState>();
  const initialSerializedState = serializeState(
    initialState,
    undefined,
    undefined
  );
  stateMap.set(initialSerializedState, initialState);

  weightMap.set(initialSerializedState, [0, undefined, undefined]);
  const unvisited = new Set<SerializedState>();
  const visited = new Set<SerializedState>();

  unvisited.add(initialSerializedState);
  for (const serializedState of unvisited) {
    const [weight] = weightMap.get(serializedState)!;
    for (const event of Object.keys(
      adjacencyMap[serializedState].transitions
    ) as SerializedEvent[]) {
      const { state: nextState, event: eventObject } = adjacencyMap[
        serializedState
      ].transitions[event];
      const prevState = stateMap.get(serializedState);
      const nextSerializedState = serializeState(
        nextState,
        eventObject,
        prevState
      );
      stateMap.set(nextSerializedState, nextState);
      if (!weightMap.has(nextSerializedState)) {
        weightMap.set(nextSerializedState, [
          weight + 1,
          serializedState,
          eventObject
        ]);
      } else {
        const [nextWeight] = weightMap.get(nextSerializedState)!;
        if (nextWeight > weight + 1) {
          weightMap.set(nextSerializedState, [
            weight + 1,
            serializedState,
            eventObject
          ]);
        }
      }
      if (!visited.has(nextSerializedState)) {
        unvisited.add(nextSerializedState);
      }
    }
    visited.add(serializedState);
    unvisited.delete(serializedState);
  }

  const statePlanMap: StatePlanMap<TState, TEvent> = {};

  weightMap.forEach(([weight, fromState, fromEvent], stateSerial) => {
    const state = stateMap.get(stateSerial)!;
    statePlanMap[stateSerial] = {
      state,
      paths: !fromState
        ? [
            {
              state,
              steps: [],
              weight
            }
          ]
        : [
            {
              state,
              steps: statePlanMap[fromState].paths[0].steps.concat({
                state: stateMap.get(fromState)!,
                event: fromEvent!
              }),
              weight
            }
          ]
    };
  });

  return Object.values(statePlanMap);
}
