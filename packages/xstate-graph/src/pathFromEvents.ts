import {
  ActorScope,
  ActorLogic,
  ActorSystem,
  AnyStateMachine,
  EventObject,
  Snapshot
} from 'xstate';
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
import { createMockActorScope } from './actorScope';

function isMachine(value: any): value is AnyStateMachine {
  return !!value && '__xstatenode' in value;
}

export function getPathsFromEvents<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TSystem extends ActorSystem<any> = ActorSystem<any>
>(
  logic: ActorLogic<TSnapshot, TEvent, TInput, TSystem>,
  events: TEvent[],
  options?: TraversalOptions<TSnapshot, TEvent>
): Array<StatePath<TSnapshot, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(
    logic,
    {
      events,
      ...options
    },
    (isMachine(logic)
      ? createDefaultMachineOptions(logic)
      : createDefaultLogicOptions()) as TraversalOptions<TSnapshot, TEvent>
  );
  const actorScope = createMockActorScope() as ActorScope<
    TSnapshot,
    TEvent,
    TSystem
  >;
  const fromState =
    resolvedOptions.fromState ??
    logic.getInitialState(
      actorScope,
      // TODO: fix this
      undefined as TInput
    );

  const { serializeState, serializeEvent } = resolvedOptions;

  const adjacency = getAdjacencyMap(logic, resolvedOptions);

  const stateMap = new Map<SerializedState, TSnapshot>();
  const steps: Steps<TSnapshot, TEvent> = [];

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
