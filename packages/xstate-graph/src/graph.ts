import {
  StateNode,
  State,
  DefaultContext,
  Event,
  EventObject,
  AnyEventObject
} from 'xstate';
import { flatten, keys } from 'xstate/lib/utils';
import {
  StatePathsMap,
  StatePaths,
  AdjacencyMap,
  Segments,
  ValueAdjMapOptions
} from './types';
import { MachineNode } from 'xstate/lib/MachineNode';

export function toEventObject<TEvent extends EventObject>(
  event: Event<TEvent>
): TEvent {
  if (typeof event === 'string' || typeof event === 'number') {
    return { type: event } as TEvent;
  }

  return event;
}

const EMPTY_MAP = {};

/**
 * Returns all state nodes of the given `node`.
 * @param stateNode State node to recursively get child state nodes from
 */
export function getStateNodes(
  stateNode: StateNode | MachineNode<any, any, any>
): StateNode[] {
  const { states } = stateNode;
  const nodes = keys(states).reduce((accNodes: StateNode[], stateKey) => {
    const childStateNode = states[stateKey];
    const childStateNodes = getStateNodes(childStateNode);

    accNodes.push(childStateNode, ...childStateNodes);
    return accNodes;
  }, []);

  return nodes;
}

export function serializeState<TContext>(state: State<TContext, any>): string {
  const { value, context } = state;
  return context === undefined
    ? JSON.stringify(value)
    : JSON.stringify(value) + ' | ' + JSON.stringify(context);
}

export function serializeEvent<TEvent extends EventObject>(
  event: TEvent
): string {
  return JSON.stringify(event);
}

export function deserializeEventString<TEvent extends EventObject>(
  eventString: string
): TEvent {
  return JSON.parse(eventString) as TEvent;
}

const defaultValueAdjMapOptions: ValueAdjMapOptions<any, any> = {
  events: {},
  filter: () => true,
  stateSerializer: serializeState,
  eventSerializer: serializeEvent
};

export function getAdjacencyMap<
  TContext = DefaultContext,
  TEvent extends EventObject = AnyEventObject
>(
  node: MachineNode<TContext, any, TEvent> | MachineNode<TContext, any, TEvent>,
  options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
): AdjacencyMap<TContext, TEvent> {
  const optionsWithDefaults = {
    ...defaultValueAdjMapOptions,
    ...options
  } as ValueAdjMapOptions<TContext, TEvent>;
  const { filter, stateSerializer, eventSerializer } = optionsWithDefaults;
  const events = {} as Record<TEvent['type'], Array<Event<TEvent>>>;
  for (const event of node.events) {
    events[event] = [event];
  }
  Object.assign(events, optionsWithDefaults.events);

  const adjacency: AdjacencyMap<TContext, TEvent> = {};

  function findAdjacencies(state: State<TContext, TEvent>) {
    const { nextEvents } = state;
    const stateHash = stateSerializer(state);

    if (adjacency[stateHash]) {
      return;
    }

    adjacency[stateHash] = {};

    const potentialEvents = flatten<TEvent>(
      nextEvents.map(nextEvent => events[nextEvent] || [])
    ).map(event => toEventObject(event));

    for (const event of potentialEvents) {
      let nextState: State<TContext, TEvent>;
      try {
        nextState = node.transition(state, event);
      } catch (e) {
        throw new Error(
          `Unable to transition from state ${stateSerializer(
            state
          )} on event ${eventSerializer(event)}: ${e.message}`
        );
      }

      if (
        (!filter || filter(nextState)) &&
        stateHash !== stateSerializer(nextState)
      ) {
        adjacency[stateHash][eventSerializer(event)] = {
          state: nextState,
          event
        };

        findAdjacencies(nextState);
      }
    }
  }

  findAdjacencies(node.initialState);

  return adjacency;
}

export function getShortestPaths<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: MachineNode<TContext, any, TEvent>,
  options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
): StatePathsMap<TContext, TEvent> {
  if (!machine.states) {
    // return EMPTY_MAP;
    return EMPTY_MAP;
  }
  const optionsWithDefaults = {
    events: {},
    stateSerializer: serializeState,
    eventSerializer: serializeEvent,
    ...options
  } as ValueAdjMapOptions<TContext, TEvent>;

  const adjacency = getAdjacencyMap<TContext, TEvent>(
    machine,
    optionsWithDefaults
  );

  // weight, state, event
  const weightMap = new Map<
    string,
    [number, string | undefined, string | undefined]
  >();
  const stateMap = new Map<string, State<TContext, TEvent>>();
  const initialVertex = optionsWithDefaults.stateSerializer(
    machine.initialState
  );
  stateMap.set(initialVertex, machine.initialState);

  weightMap.set(initialVertex, [0, undefined, undefined]);
  const unvisited = new Set<string>();
  const visited = new Set<string>();

  unvisited.add(initialVertex);
  while (unvisited.size > 0) {
    for (const vertex of unvisited) {
      const [weight] = weightMap.get(vertex)!;
      for (const event of keys(adjacency[vertex])) {
        const nextSegment = adjacency[vertex][event];
        const nextVertex = optionsWithDefaults.stateSerializer(
          nextSegment.state
        );
        stateMap.set(nextVertex, nextSegment.state);
        if (!weightMap.has(nextVertex)) {
          weightMap.set(nextVertex, [weight + 1, vertex, event]);
        } else {
          const [nextWeight] = weightMap.get(nextVertex)!;
          if (nextWeight > weight + 1) {
            weightMap.set(nextVertex, [weight + 1, vertex, event]);
          }
        }
        if (!visited.has(nextVertex)) {
          unvisited.add(nextVertex);
        }
      }
      visited.add(vertex);
      unvisited.delete(vertex);
    }
  }

  const statePathMap: StatePathsMap<TContext, TEvent> = {};

  weightMap.forEach(([weight, fromState, fromEvent], stateSerial) => {
    const state = stateMap.get(stateSerial)!;
    statePathMap[stateSerial] = {
      state,
      paths: !fromState
        ? [
            {
              state,
              segments: [],
              weight
            }
          ]
        : [
            {
              state,
              segments: statePathMap[fromState].paths[0].segments.concat({
                state: stateMap.get(fromState)!,
                event: deserializeEventString(fromEvent!) as TEvent
              }),
              weight
            }
          ]
    };
  });

  return statePathMap;
}

export function getSimplePaths<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: MachineNode<TContext, any, TEvent>,
  options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
): StatePathsMap<TContext, TEvent> {
  const optionsWithDefaults = {
    ...defaultValueAdjMapOptions,
    ...options
  };

  const { stateSerializer } = optionsWithDefaults;

  if (!machine.states) {
    return EMPTY_MAP;
  }

  // @ts-ignore - excessively deep
  const adjacency = getAdjacencyMap(machine, optionsWithDefaults);
  const stateMap = new Map<string, State<TContext, TEvent>>();
  const visited = new Set();
  const path: Segments<TContext, TEvent> = [];
  const paths: StatePathsMap<TContext, TEvent> = {};

  function util(fromState: State<TContext, TEvent>, toStateSerial: string) {
    const fromStateSerial = stateSerializer(fromState);
    visited.add(fromStateSerial);

    if (fromStateSerial === toStateSerial) {
      if (!paths[toStateSerial]) {
        paths[toStateSerial] = {
          state: stateMap.get(toStateSerial)!,
          paths: []
        };
      }
      paths[toStateSerial].paths.push({
        state: fromState,
        weight: path.length,
        segments: [...path]
      });
    } else {
      for (const subEvent of keys(adjacency[fromStateSerial])) {
        const nextSegment = adjacency[fromStateSerial][subEvent];

        if (!nextSegment) {
          continue;
        }

        const nextStateSerial = stateSerializer(nextSegment.state);
        stateMap.set(nextStateSerial, nextSegment.state);

        if (!visited.has(nextStateSerial)) {
          path.push({
            state: stateMap.get(fromStateSerial)!,
            event: deserializeEventString(subEvent)
          });
          util(nextSegment.state, toStateSerial);
        }
      }
    }

    path.pop();
    visited.delete(fromStateSerial);
  }

  const initialStateSerial = stateSerializer(machine.initialState);
  stateMap.set(initialStateSerial, machine.initialState);

  for (const nextStateSerial of keys(adjacency)) {
    util(machine.initialState, nextStateSerial);
  }

  return paths;
}

export function getSimplePathsAsArray<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: MachineNode<TContext, any, TEvent>,
  options?: ValueAdjMapOptions<TContext, TEvent>
): Array<StatePaths<TContext, TEvent>> {
  const result = getSimplePaths(machine, options);
  return keys(result).map(key => result[key]);
}
