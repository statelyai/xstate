import { AnyActorLogic, EventFromLogic, InputFrom } from 'xstate';
import {
  SerializedEvent,
  SerializedSnapshot,
  StatePath,
  Steps,
  TraversalOptions,
  VisitedContext
} from './types';
import { resolveTraversalOptions } from './graph';
import { getAdjacencyMap } from './adjacency';
import { alterPath } from './alterPath';
import { createMockActorScope } from './actorScope';

export function getSimplePaths<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: TraversalOptions<
    ReturnType<TLogic['transition']>,
    EventFromLogic<TLogic>,
    InputFrom<TLogic>
  >
): Array<StatePath<ReturnType<TLogic['transition']>, EventFromLogic<TLogic>>> {
  type TState = ReturnType<TLogic['transition']>;
  type TEvent = EventFromLogic<TLogic>;

  const resolvedOptions = resolveTraversalOptions(logic, options);
  const actorScope = createMockActorScope();
  const fromState =
    resolvedOptions.fromState ??
    logic.getInitialSnapshot(actorScope, options?.input);
  const serializeState = resolvedOptions.serializeState as (
    ...args: Parameters<typeof resolvedOptions.serializeState>
  ) => SerializedSnapshot;
  const adjacency = getAdjacencyMap(logic, resolvedOptions);
  const stateMap = new Map<SerializedSnapshot, TState>();
  const visitCtx: VisitedContext<TState, TEvent> = {
    vertices: new Set(),
    edges: new Set()
  };
  const steps: Steps<TState, TEvent> = [];
  const pathMap: Record<
    SerializedSnapshot,
    { state: TState; paths: Array<StatePath<TState, TEvent>> }
  > = {};

  function util(
    fromStateSerial: SerializedSnapshot,
    toStateSerial: SerializedSnapshot
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
        weight: steps.length,
        steps: [...steps]
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
          steps.push({
            state: stateMap.get(fromStateSerial)!,
            event: subEvent
          });
          util(nextStateSerial, toStateSerial);
        }
      }
    }

    steps.pop();
    visitCtx.vertices.delete(fromStateSerial);
  }

  const fromStateSerial = serializeState(fromState, undefined);
  stateMap.set(fromStateSerial, fromState);

  for (const nextStateSerial of Object.keys(
    adjacency
  ) as SerializedSnapshot[]) {
    util(fromStateSerial, nextStateSerial);
  }

  const simplePaths = Object.values(pathMap).flatMap((p) => p.paths);

  if (resolvedOptions.toState) {
    return simplePaths
      .filter((path) => resolvedOptions.toState!(path.state))
      .map(alterPath);
  }

  return simplePaths.map(alterPath);
}
