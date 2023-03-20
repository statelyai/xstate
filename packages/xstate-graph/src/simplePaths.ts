import { EventObject, AnyStateMachine, StateFrom, EventFrom } from 'xstate';
import {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  Step,
  TraversalOptions,
  VisitedContext
} from './types';
import { resolveTraversalOptions, createDefaultMachineOptions } from './graph';
import { getAdjacencyMap } from './adjacency';
import { flatten } from 'xstate/lib/utils';

export function getMachineSimplePaths<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>
): Array<StatePath<StateFrom<TMachine>, EventFrom<TMachine>>> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    createDefaultMachineOptions(machine)
  );

  return getSimplePaths(machine as SimpleBehavior<any, any>, resolvedOptions);
}

export function getSimplePaths<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): Array<StatePath<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const fromState = resolvedOptions.fromState ?? behavior.initialState;
  const serializeState = resolvedOptions.serializeState as (
    ...args: Parameters<typeof resolvedOptions.serializeState>
  ) => SerializedState;
  const adjacency = getAdjacencyMap(behavior, resolvedOptions);
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
        adjacency[fromStateSerial].transitions
      ) as SerializedEvent[]) {
        const { state: nextState, event: subEvent } =
          adjacency[fromStateSerial].transitions[serializedEvent];

        if (!(serializedEvent in adjacency[fromStateSerial].transitions)) {
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

  const fromStateSerial = serializeState(fromState, undefined);
  stateMap.set(fromStateSerial, fromState);

  for (const nextStateSerial of Object.keys(adjacency) as SerializedState[]) {
    util(fromStateSerial, nextStateSerial);
  }

  let simplePaths = flatten(Object.values(pathMap).map((p) => p.paths));

  if (resolvedOptions.toState) {
    simplePaths = simplePaths.filter((path) =>
      resolvedOptions.toState!(path.state)
    );
  }

  simplePaths.forEach((path) => {
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

  return simplePaths;
}
