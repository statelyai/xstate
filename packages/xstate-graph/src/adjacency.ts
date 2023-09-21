import {
  ActorInternalState,
  ActorLogic,
  ActorSystem,
  EventObject
} from 'xstate';
import { SerializedEvent, SerializedState, TraversalOptions } from './types';
import { AdjacencyMap, resolveTraversalOptions } from './graph';

export function getAdjacencyMap<
  TSnapshot,
  TEvent extends EventObject,
  TInput,
  TOutput,
  TInternalState extends ActorInternalState<
    TSnapshot,
    TOutput
  > = ActorInternalState<TSnapshot, TOutput>,
  TPersisted = TInternalState,
  TSystem extends ActorSystem<any> = ActorSystem<any>
>(
  logic: ActorLogic<
    TSnapshot,
    TEvent,
    TInput,
    TOutput,
    TInternalState,
    TPersisted,
    TSystem
  >,
  options: TraversalOptions<TInternalState, TEvent>
): AdjacencyMap<TInternalState, TEvent> {
  const { transition } = logic;
  const {
    serializeEvent,
    serializeState,
    events: getEvents,
    traversalLimit: limit,
    fromState: customFromState,
    stopCondition
  } = resolveTraversalOptions(logic, options);
  const actorContext = { self: {} } as any; // TODO: figure out the simulation API
  const fromState =
    customFromState ??
    logic.getInitialState(
      actorContext,
      // TODO: fix this
      undefined as TInput
    );
  const adj: AdjacencyMap<TInternalState, TEvent> = {};

  let iterations = 0;
  const queue: Array<{
    nextState: TInternalState;
    event: TEvent | undefined;
    prevState: TInternalState | undefined;
  }> = [{ nextState: fromState, event: undefined, prevState: undefined }];
  const stateMap = new Map<SerializedState, TInternalState>();

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
      const nextState = transition(state, nextEvent, actorContext);

      if (!options.filter || options.filter(nextState, nextEvent)) {
        adj[serializedState].transitions[
          serializeEvent(nextEvent) as SerializedEvent
        ] = {
          event: nextEvent,
          state: nextState
        };
        queue.push({ nextState, event: nextEvent, prevState: state });
      }
    }
  }

  return adj;
}
