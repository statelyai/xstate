import { EventObject, AnyStateMachine, StateFrom, EventFrom } from 'xstate';
import {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  StatePlan,
  StatePlanMap,
  TraversalOptions
} from './types';
import {
  resolveTraversalOptions,
  createDefaultMachineOptions,
  filterPlans
} from './graph';
import { getAdjacencyMap } from './adjacency';
import { mapPlansToPaths } from './utils';

export function getMachineShortestPlans<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>
): Array<StatePlan<StateFrom<TMachine>, EventFrom<TMachine>>> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    createDefaultMachineOptions(machine)
  );

  return getShortestPlans(
    {
      transition: (state, event) => machine.transition(state, event),
      initialState: machine.initialState
    },
    resolvedOptions
  ) as Array<StatePlan<StateFrom<TMachine>, EventFrom<TMachine>>>;
}

export function getMachineShortestPaths<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>
): Array<StatePath<StateFrom<TMachine>, EventFrom<TMachine>>> {
  return mapPlansToPaths(getMachineShortestPlans(machine, options));
}

export function getShortestPlans<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options?: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const config = resolveTraversalOptions(options);
  const serializeState = config.serializeState as (
    ...args: Parameters<typeof config.serializeState>
  ) => SerializedState;
  const fromState = config.fromState ?? behavior.initialState;
  const adjacency = getAdjacencyMap(behavior, config);

  // weight, state, event
  const weightMap = new Map<
    SerializedState,
    {
      weight: number;
      state: SerializedState | undefined;
      event: TEvent | undefined;
    }
  >();
  const stateMap = new Map<SerializedState, TState>();
  const initialSerializedState = serializeState(
    fromState,
    undefined,
    undefined
  );
  stateMap.set(initialSerializedState, fromState);

  weightMap.set(initialSerializedState, {
    weight: 0,
    state: undefined,
    event: undefined
  });
  const unvisited = new Set<SerializedState>();
  const visited = new Set<SerializedState>();

  unvisited.add(initialSerializedState);
  for (const serializedState of unvisited) {
    const { weight } = weightMap.get(serializedState)!;
    for (const event of Object.keys(
      adjacency[serializedState].transitions
    ) as SerializedEvent[]) {
      const { state: nextState, event: eventObject } = adjacency[
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
        weightMap.set(nextSerializedState, {
          weight: weight + 1,
          state: serializedState,
          event: eventObject
        });
      } else {
        const { weight: nextWeight } = weightMap.get(nextSerializedState)!;
        if (nextWeight > weight + 1) {
          weightMap.set(nextSerializedState, {
            weight: weight + 1,
            state: serializedState,
            event: eventObject
          });
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

  weightMap.forEach(
    ({ weight, state: fromState, event: fromEvent }, stateSerial) => {
      const state = stateMap.get(stateSerial)!;
      statePlanMap[stateSerial] = {
        state,
        paths: [
          {
            state,
            steps: !fromState
              ? []
              : statePlanMap[fromState].paths[0].steps.concat({
                  state: stateMap.get(fromState)!,
                  event: fromEvent!
                }),
            weight
          }
        ]
      };
    }
  );

  return Object.values(statePlanMap);
}

export function getShortestPlansTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  predicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = getShortestPlans(behavior, resolvedOptions);

  return filterPlans(simplePlansMap, predicate);
}

export function getShortestPlansFromTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  fromPredicate: (state: TState) => boolean,
  toPredicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const shortesPlansMap = getShortestPlans(behavior, resolvedOptions);

  // Return all plans that contain a "from" state and target a "to" state
  return filterPlans(shortesPlansMap, (state, plan) => {
    return (
      toPredicate(state) && plan.paths.some((path) => fromPredicate(path.state))
    );
  });
}
