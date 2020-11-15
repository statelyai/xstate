import {
  DefaultContext,
  Event,
  EventObject,
  StateMachine,
  AnyEventObject,
  State
} from 'xstate';
import { flatten } from 'xstate/lib/utils';
import { FST, machineToFST } from 'xstate/lib/fst';
import { AdjacencyMap, ValueAdjMapOptions, AdjacencyMapFST } from './types';
import { defaultValueAdjMapOptions, toEventObject } from './graph';

export function nextEventsGetter<TContext, TEvent extends EventObject>(
  machine: StateMachine<TContext, any, TEvent>,
  events: Record<TEvent['type'], Array<Event<TEvent>>>
): (state: State<TContext, TEvent>) => TEvent[] {
  const allEvents = {} as Record<TEvent['type'], Array<Event<TEvent>>>;
  for (const event of machine.events) {
    allEvents[event] = [event];
  }
  Object.assign(allEvents, events);

  return (state) => {
    const { nextEvents } = state;
    const potentialEvents = flatten<TEvent>(
      nextEvents.map((nextEvent) => allEvents[nextEvent] || [])
    ).map((event) => toEventObject(event));

    return potentialEvents;
  };
}

export function getAdjacencyMap<
  TContext = DefaultContext,
  TEvent extends EventObject = AnyEventObject
>(
  machine: StateMachine<TContext, any, TEvent>,
  options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
): AdjacencyMap<TContext, TEvent> {
  const optionsWithDefaults = {
    ...defaultValueAdjMapOptions,
    ...options
  } as ValueAdjMapOptions<TContext, TEvent>;

  const fst = machineToFST(
    machine,
    nextEventsGetter(machine, optionsWithDefaults.events as any)
  );

  const adjacency = getAdjacencyMapFST(fst, options);

  return adjacency;
}

export function getAdjacencyMapFST<TState, TInput>(
  fst: FST<TState, TInput>,
  options?: Partial<ValueAdjMapOptions<any, any>>
): AdjacencyMapFST<TState, TInput> {
  const optionsWithDefaults = {
    ...defaultValueAdjMapOptions,
    ...options
  } as ValueAdjMapOptions<any, any>;
  const { filter, stateSerializer, eventSerializer } = optionsWithDefaults;

  const adjacency: AdjacencyMapFST<TState, TInput> = {};

  function findAdjacencies(state: TState) {
    const potentialEvents = fst.nextEvents?.(state) || fst.events;
    const stateHash = stateSerializer(state as any);

    if (adjacency[stateHash]) {
      return;
    }

    adjacency[stateHash] = {};

    for (const event of potentialEvents) {
      let nextState: TState;
      try {
        nextState = fst.transition(state, event)[0];
      } catch (e) {
        throw new Error(
          `Unable to transition from state ${stateSerializer(
            state as any
          )} on event ${eventSerializer(event)}: ${e.message}`
        );
      }

      if (
        (!filter || filter(nextState as any)) &&
        stateHash !== stateSerializer(nextState as any)
      ) {
        adjacency[stateHash][eventSerializer(event)] = {
          state: nextState,
          event
        };

        findAdjacencies(nextState);
      }
    }
  }

  findAdjacencies(fst.initialState);

  return adjacency;
}
