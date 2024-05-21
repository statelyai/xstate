import { AnyActorLogic, EventFromLogic, InputFrom } from 'xstate';
import { getAdjacencyMap } from './adjacency';
import { alterPath } from './alterPath';
import { resolveTraversalOptions } from './graph';
import {
  SerializedEvent,
  SerializedSnapshot,
  StatePath,
  StatePlanMap,
  TraversalOptions
} from './types';
import { createMockActorScope } from './actorScope';

export function getShortestPaths<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: TraversalOptions<
    ReturnType<TLogic['transition']>,
    EventFromLogic<TLogic>,
    InputFrom<TLogic>
  >
): Array<StatePath<ReturnType<TLogic['transition']>, EventFromLogic<TLogic>>> {
  type TInternalState = ReturnType<TLogic['transition']>;
  type TEvent = EventFromLogic<TLogic>;

  const resolvedOptions = resolveTraversalOptions(logic, options);
  const serializeState = resolvedOptions.serializeState as (
    ...args: Parameters<typeof resolvedOptions.serializeState>
  ) => SerializedSnapshot;
  const fromState =
    resolvedOptions.fromState ??
    logic.getInitialSnapshot(createMockActorScope(), options?.input);
  const adjacency = getAdjacencyMap(logic, resolvedOptions);

  // weight, state, event
  const weightMap = new Map<
    SerializedSnapshot,
    {
      weight: number;
      state: SerializedSnapshot | undefined;
      event: TEvent | undefined;
    }
  >();
  const stateMap = new Map<SerializedSnapshot, TInternalState>();
  const serializedFromState = serializeState(fromState, undefined, undefined);
  stateMap.set(serializedFromState, fromState);

  weightMap.set(serializedFromState, {
    weight: 0,
    state: undefined,
    event: undefined
  });
  const unvisited = new Set<SerializedSnapshot>();
  const visited = new Set<SerializedSnapshot>();

  unvisited.add(serializedFromState);
  for (const serializedState of unvisited) {
    const prevState = stateMap.get(serializedState);
    const { weight } = weightMap.get(serializedState)!;
    for (const event of Object.keys(
      adjacency[serializedState].transitions
    ) as SerializedEvent[]) {
      const { state: nextState, event: eventObject } =
        adjacency[serializedState].transitions[event];
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

  const statePlanMap: StatePlanMap<TInternalState, TEvent> = {};
  const paths: Array<StatePath<TInternalState, TEvent>> = [];

  weightMap.forEach(
    ({ weight, state: fromState, event: fromEvent }, stateSerial) => {
      const state = stateMap.get(stateSerial)!;
      const steps = !fromState
        ? []
        : statePlanMap[fromState].paths[0].steps.concat({
            state: stateMap.get(fromState)!,
            event: fromEvent!
          });

      paths.push({
        state,
        steps,
        weight
      });
      statePlanMap[stateSerial] = {
        state,
        paths: [
          {
            state,
            steps,
            weight
          }
        ]
      };
    }
  );

  if (resolvedOptions.toState) {
    return paths
      .filter((path) => resolvedOptions.toState!(path.state))
      .map(alterPath);
  }

  return paths.map(alterPath);
}
