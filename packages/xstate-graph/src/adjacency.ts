import {
  ActorScope,
  ActorLogic,
  ActorSystem,
  EventObject,
  Snapshot
} from 'xstate';
import { SerializedEvent, SerializedState, TraversalOptions } from './types';
import { AdjacencyMap, resolveTraversalOptions } from './graph';
import { createMockActorScope } from './actorScope';

export function getAdjacencyMap<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TSystem extends ActorSystem<any> = ActorSystem<any>
>(
  logic: ActorLogic<TSnapshot, TEvent, TInput, TSystem>,
  options: TraversalOptions<TSnapshot, TEvent>
): AdjacencyMap<TSnapshot, TEvent> {
  const { transition } = logic;
  const {
    serializeEvent,
    serializeState,
    events: getEvents,
    traversalLimit: limit,
    fromState: customFromState,
    stopCondition
  } = resolveTraversalOptions(logic, options);
  const actorScope = createMockActorScope() as ActorScope<
    TSnapshot,
    TEvent,
    TSystem
  >;
  const fromState =
    customFromState ??
    logic.getInitialState(
      actorScope,
      // TODO: fix this
      undefined as TInput
    );
  const adj: AdjacencyMap<TSnapshot, TEvent> = {};

  let iterations = 0;
  const queue: Array<{
    nextState: TSnapshot;
    event: TEvent | undefined;
    prevState: TSnapshot | undefined;
  }> = [{ nextState: fromState, event: undefined, prevState: undefined }];
  const stateMap = new Map<SerializedState, TSnapshot>();

  while (queue.length) {
    const { nextState: state, event, prevState } = queue.shift()!;

    if (iterations++ > limit) {
      throw new Error('Traversal limit exceeded');
    }

    const serializedState = serializeState(
      state,
      event,
      prevState
    ) as SerializedState;
    if (adj[serializedState]) {
      continue;
    }
    stateMap.set(serializedState, state);

    adj[serializedState] = {
      state,
      transitions: {}
    };

    if (stopCondition && stopCondition(state)) {
      continue;
    }

    const events =
      typeof getEvents === 'function' ? getEvents(state) : getEvents;

    for (const nextEvent of events) {
      const nextSnapshot = transition(state, nextEvent, actorScope);

      if (!options.filter || options.filter(nextSnapshot, nextEvent)) {
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
  }

  return adj;
}
