import {
  ActorScope,
  ActorLogic,
  ActorSystem,
  EventObject,
  Snapshot
} from 'xstate';
import { SerializedEvent, SerializedSnapshot, TraversalOptions } from './types';
import { AdjacencyMap, AdjacencyValue, resolveTraversalOptions } from './graph';
import { createMockActorScope } from './actorScope';

export function getAdjacencyMap<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TSystem extends ActorSystem<any> = ActorSystem<any>
>(
  logic: ActorLogic<TSnapshot, TEvent, TInput, TSystem>,
  options: TraversalOptions<TSnapshot, TEvent, TInput>
): AdjacencyMap<TSnapshot, TEvent> {
  const { transition } = logic;
  const {
    serializeEvent,
    serializeState,
    events: getEvents,
    limit,
    fromState: customFromState,
    stopWhen
  } = resolveTraversalOptions(logic, options);
  const actorScope = createMockActorScope() as ActorScope<
    TSnapshot,
    TEvent,
    TSystem
  >;
  const fromState =
    customFromState ??
    logic.getInitialSnapshot(
      actorScope,
      // TODO: fix this
      options.input as TInput
    );
  const adj: AdjacencyMap<TSnapshot, TEvent> = {};

  let iterations = 0;
  const queue: Array<{
    nextState: TSnapshot;
    event: TEvent | undefined;
    prevState: TSnapshot | undefined;
  }> = [{ nextState: fromState, event: undefined, prevState: undefined }];
  const stateMap = new Map<SerializedSnapshot, TSnapshot>();

  while (queue.length) {
    const { nextState: state, event, prevState } = queue.shift()!;

    if (iterations++ > limit) {
      throw new Error('Traversal limit exceeded');
    }

    const serializedState = serializeState(
      state,
      event,
      prevState
    ) as SerializedSnapshot;
    if (adj[serializedState]) {
      continue;
    }
    stateMap.set(serializedState, state);

    adj[serializedState] = {
      state,
      transitions: {}
    };

    if (stopWhen && stopWhen(state)) {
      continue;
    }

    const events =
      typeof getEvents === 'function' ? getEvents(state) : getEvents;

    for (const nextEvent of events) {
      const nextSnapshot = transition(state, nextEvent, actorScope);

      adj[serializedState].transitions[
        serializeEvent(nextEvent) as SerializedEvent
      ] = {
        event: nextEvent,
        state: nextSnapshot
      };
      queue.push({
        nextState: nextSnapshot,
        event: nextEvent,
        prevState: state
      });
    }
  }

  return adj;
}

export function adjacencyMapToArray<TSnapshot, TEvent>(
  adjMap: AdjacencyMap<TSnapshot, TEvent>
): Array<{
  state: TSnapshot;
  event: TEvent;
  nextState: TSnapshot;
}> {
  const adjList: Array<{
    state: TSnapshot;
    event: TEvent;
    nextState: TSnapshot;
  }> = [];

  for (const adjValue of Object.values(adjMap)) {
    for (const transition of Object.values(
      (adjValue as AdjacencyValue<TSnapshot, TEvent>).transitions
    )) {
      adjList.push({
        state: (adjValue as AdjacencyValue<TSnapshot, TEvent>).state,
        event: transition.event,
        nextState: transition.state
      });
    }
  }

  return adjList;
}
