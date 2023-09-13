import { ActorLogic, ActorSystem, AnyStateMachine, EventObject } from 'xstate';
import { getAdjacencyMap } from './adjacency';
import {
  SerializedEvent,
  SerializedState,
  StatePath,
  Steps,
  TraversalOptions
} from './types';
import {
  resolveTraversalOptions,
  createDefaultMachineOptions,
  createDefaultLogicOptions
} from './graph';
import { alterPath } from './alterPath';

function isMachine(value: any): value is AnyStateMachine {
  return !!value && '__xstatenode' in value;
}

export function getPathsFromEvents<
  TEvent extends EventObject,
  TSnapshot,
  TInternalState = TSnapshot,
  TPersisted = TInternalState,
  TSystem extends ActorSystem<any> = ActorSystem<any>
>(
  logic: ActorLogic<TEvent, TSnapshot, TInternalState, TPersisted, TSystem>,
  events: TEvent[],
  options?: TraversalOptions<TInternalState, TEvent>
): Array<StatePath<TInternalState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(
    logic,
    {
      events,
      ...options
    },
    (isMachine(logic)
      ? createDefaultMachineOptions(logic)
      : createDefaultLogicOptions()) as TraversalOptions<TInternalState, TEvent>
  );
  const actorContext = { self: {} } as any; // TODO: figure out the simulation API
  const fromState =
    resolvedOptions.fromState ?? logic.getInitialState(actorContext, undefined);

  const { serializeState, serializeEvent } = resolvedOptions;

  const adjacency = getAdjacencyMap(logic, resolvedOptions);

  const stateMap = new Map<SerializedState, TInternalState>();
  const steps: Steps<TInternalState, TEvent> = [];

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

    const eventSerial = serializeEvent(event) as SerializedEvent;
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
    alterPath({
      state,
      steps,
      weight: steps.length
    })
  ];
}
