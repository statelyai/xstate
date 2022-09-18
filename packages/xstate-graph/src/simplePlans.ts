import { AnyStateMachine, EventFrom, EventObject, StateFrom } from 'xstate';
import {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  StatePlan,
  TraversalOptions,
  VisitedContext
} from './types';
import {
  resolveTraversalOptions,
  AdjacencyMap,
  defaultMachineStateOptions,
  filterPlans
} from './graph';
import { getAdjacencyMap } from './adjacency';

export function getMachineSimplePlans<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: Partial<TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>>
): Array<StatePlan<StateFrom<TMachine>, EventFrom<TMachine>>> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    defaultMachineStateOptions
  );

  return getSimplePlans(machine as SimpleBehavior<any, any>, resolvedOptions);
}

export function getSimplePlans<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: Partial<TraversalOptions<TState, TEvent>>
): Array<StatePlan<TState, TEvent>> {
  const { initialState } = behavior;
  const resolvedOptions = resolveTraversalOptions(options);
  const adjacency = getAdjacencyMap(behavior, resolvedOptions);

  return baseGetSimplePlans(adjacency, initialState, resolvedOptions);
}

export function baseGetSimplePlans<TState, TEvent extends EventObject>(
  adjacencyMap: AdjacencyMap<TState, TEvent>,
  initialState: TState,
  options: Required<TraversalOptions<TState, TEvent>>
) {
  const serializeState = options.serializeState as (
    ...args: Parameters<typeof options.serializeState>
  ) => SerializedState;
  const stateMap = new Map<SerializedState, TState>();
  const visitCtx: VisitedContext<TState, TEvent> = {
    vertices: new Set(),
    edges: new Set()
  };
  const path: any[] = [];
  const pathMap: Record<
    SerializedState,
    { state: TState; paths: Array<StatePath<TState, TEvent>> }
  > = {};

  function util(
    fromStateSerial: SerializedState,
    toStateSerial: SerializedState
  ) {
    const fromState = stateMap.get(fromStateSerial)!;
    visitCtx.vertices.add(fromStateSerial);

    if (fromStateSerial === toStateSerial) {
      if (!pathMap[toStateSerial]) {
        pathMap[toStateSerial] = {
          state: stateMap.get(toStateSerial)!,
          paths: []
        };
      }

      const toStatePlan = pathMap[toStateSerial];

      const path2: StatePath<TState, TEvent> = {
        state: fromState,
        weight: path.length,
        steps: [...path]
      };

      toStatePlan.paths.push(path2);
    } else {
      for (const serializedEvent of Object.keys(
        adjacencyMap[fromStateSerial].transitions
      ) as SerializedEvent[]) {
        const { state: nextState, event: subEvent } = adjacencyMap[
          fromStateSerial
        ].transitions[serializedEvent];

        if (!(serializedEvent in adjacencyMap[fromStateSerial].transitions)) {
          continue;
        }
        const prevState = stateMap.get(fromStateSerial);

        const nextStateSerial = serializeState(nextState, subEvent, prevState);
        stateMap.set(nextStateSerial, nextState);

        if (!visitCtx.vertices.has(nextStateSerial)) {
          visitCtx.edges.add(serializedEvent);
          path.push({
            state: stateMap.get(fromStateSerial)!,
            event: subEvent
          });
          util(nextStateSerial, toStateSerial);
        }
      }
    }

    path.pop();
    visitCtx.vertices.delete(fromStateSerial);
  }

  const initialStateSerial = serializeState(initialState, undefined);
  stateMap.set(initialStateSerial, initialState);

  for (const nextStateSerial of Object.keys(
    adjacencyMap
  ) as SerializedState[]) {
    util(initialStateSerial, nextStateSerial);
  }

  return Object.values(pathMap);
}

export function getSimplePlansTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  predicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = getSimplePlans(behavior, resolvedOptions);

  return filterPlans(simplePlansMap, predicate);
}

export function getSimplePlansFromTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  fromPredicate: (state: TState) => boolean,
  toPredicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = getSimplePlans(behavior, resolvedOptions);

  // Return all plans that contain a "from" state and target a "to" state
  return filterPlans(simplePlansMap, (state, plan) => {
    return (
      toPredicate(state) && plan.paths.some((path) => fromPredicate(path.state))
    );
  });
}
