import { EventObject, AnyStateMachine, StateFrom, EventFrom } from 'xstate';
import {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  StatePlanMap,
  Step,
  TraversalOptions
} from './types';
import { resolveTraversalOptions, createDefaultMachineOptions } from './graph';
import { getAdjacencyMap } from './adjacency';
import { machineToBehavior } from './machineToBehavior';

export function getShortestPaths<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options?: TraversalOptions<TState, TEvent>
): Array<StatePath<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const serializeState = resolvedOptions.serializeState as (
    ...args: Parameters<typeof resolvedOptions.serializeState>
  ) => SerializedState;
  const fromState = resolvedOptions.fromState ?? behavior.initialState;
  const adjacency = getAdjacencyMap(behavior, resolvedOptions);

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
  const serializedFromState = serializeState(fromState, undefined, undefined);
  stateMap.set(serializedFromState, fromState);

  weightMap.set(serializedFromState, {
    weight: 0,
    state: undefined,
    event: undefined
  });
  const unvisited = new Set<SerializedState>();
  const visited = new Set<SerializedState>();

  unvisited.add(serializedFromState);
  for (const serializedState of unvisited) {
    const prevState = stateMap.get(serializedState);
    const { weight } = weightMap.get(serializedState)!;
    for (const prevEvent of Object.keys(
      adjacency[serializedState].transitions
    ) as SerializedEvent[]) {
      const { state: nextState, event: eventObject } =
        adjacency[serializedState].transitions[prevEvent];
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
  let paths: Array<StatePath<TState, TEvent>> = [];

  for (const [
    stateSerial,
    { weight, state: fromState, event: fromEvent }
  ] of weightMap) {
    const state = stateMap.get(stateSerial)!;
    paths.push({
      state,
      steps: !fromState
        ? []
        : statePlanMap[fromState].paths[0].steps.concat({
            state: stateMap.get(fromState)!,
            event: fromEvent!
          }),
      weight
    });
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

  if (resolvedOptions.toState) {
    paths = paths.filter((path) => resolvedOptions.toState!(path.state));
  }

  paths.forEach((path) => {
    const steps: Step<TState, TEvent>[] = [];

    path.steps.forEach((step, i) => {
      if (i === 0) {
        steps.push({
          state: step.state,
          event: { type: 'xstate.init' } as TEvent
        });
      } else {
        steps.push({
          state: step.state,
          event: path.steps[i - 1].event
        });
      }
    });

    steps.push({
      state: path.state,
      event: path.steps[path.steps.length - 1]?.event ?? { type: 'xstate.init' }
    });

    path.steps = steps;
  });

  return paths;
}

export function getMachineShortestPaths<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>
): Array<StatePath<StateFrom<TMachine>, EventFrom<TMachine>>> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    createDefaultMachineOptions(machine, options)
  );

  return getShortestPaths(machineToBehavior(machine), resolvedOptions);
}
