import {
  EventObject,
  AnyStateMachine,
  StateFrom,
  EventFrom,
  ActorLogic,
  AnyActorLogic,
  SnapshotFrom,
  EventFromLogic
} from 'xstate';
import {
  SerializedEvent,
  SerializedState,
  StatePath,
  StatePlanMap,
  TraversalOptions
} from './types';
import { resolveTraversalOptions, createDefaultMachineOptions } from './graph';
import { getAdjacencyMap } from './adjacency';

export function getShortestPaths<
  TLogic extends AnyActorLogic,
  TState extends SnapshotFrom<TLogic>,
  TEvent extends EventFromLogic<TLogic>
>(
  logic: TLogic,
  options?: TraversalOptions<TState, TEvent>
): Array<StatePath<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(logic, options);
  const serializeState = resolvedOptions.serializeState as (
    ...args: Parameters<typeof resolvedOptions.serializeState>
  ) => SerializedState;
  const fromState =
    resolvedOptions.fromState ??
    logic.getInitialState(
      {} as any, // TODO: figure out the simulation API
      undefined
    );
  const adjacency = getAdjacencyMap(logic, resolvedOptions);

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

  const statePlanMap: StatePlanMap<TState, TEvent> = {};
  const paths: Array<StatePath<TState, TEvent>> = [];

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

export function alterPath<T extends StatePath<any, any>>(path: T): T {
  let steps: T['steps'] = [];

  if (!path.steps.length) {
    steps = [
      {
        state: path.state,
        event: { type: 'xstate.init' } as any
      }
    ];
  } else {
    for (let i = 0; i < path.steps.length; i++) {
      const step = path.steps[i];

      steps.push({
        state: step.state,
        event: i === 0 ? { type: 'xstate.init' } : path.steps[i - 1].event
      });
    }
    steps.push({
      state: path.state,
      event: path.steps[path.steps.length - 1].event
    });
  }
  return {
    ...path,
    steps
  };
}
