import {
  StateNode,
  State,
  DefaultContext,
  Event,
  EventObject,
  StateMachine
} from 'xstate';
import { flatten, keys, toEventObject } from 'xstate/lib/utils';
import { PathMap, PathsMap, PathsItem, AdjacencyMap, Segments } from './types';

const EMPTY_MAP = {};

export function getNodes(node: StateNode): StateNode[] {
  const { states } = node;
  const nodes = keys(states).reduce((accNodes: StateNode[], stateKey) => {
    const subState = states[stateKey];
    const subNodes = getNodes(states[stateKey]);

    accNodes.push(subState, ...subNodes);
    return accNodes;
  }, []);

  return nodes;
}

export function serializeState<TContext>(state: State<TContext>): string {
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

export interface ValueAdjMapOptions<TContext, TEvent extends EventObject> {
  events: { [K in TEvent['type']]: Array<TEvent & { type: K }> };
  filter: (state: State<TContext>) => boolean;
  stateSerializer: (state: State<TContext>) => string;
  eventSerializer: (event: TEvent) => string;
}

const defaultValueAdjMapOptions: ValueAdjMapOptions<any, any> = {
  events: {},
  filter: () => true,
  stateSerializer: serializeState,
  eventSerializer: serializeEvent
};

export function getAdjacencyMap<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  node: StateNode<TContext, any, TEvent>,
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
  machine: StateMachine<TContext, any, TEvent>,
  options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
): PathMap<TContext, TEvent> {
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

  const pathMap: PathMap<TContext, TEvent> = {};

  weightMap.forEach(([weight, fromState, fromEvent], stateSerial) => {
    pathMap[stateSerial] = {
      state: stateMap.get(stateSerial)!,
      weight,
      path: (() => {
        if (!fromState) {
          return [];
        }

        return pathMap[fromState].path.concat({
          state: stateMap.get(fromState)!,
          event: deserializeEventString(fromEvent!) as TEvent
        });
      })()
    };
  });

  return pathMap;
}

// export function getShortestValuePaths<
//   TContext = DefaultContext,
//   TEvent extends EventObject = EventObject
// >(
//   machine: StateNode<TContext, any, TEvent>,
//   options: ValueAdjMapOptions<TContext, TEvent> = defaultValueAdjMapOptions
// ): PathMap<TContext, TEvent> {
//   if (!machine.states) {
//     return EMPTY_MAP;
//   }
//   const adjacency = getValueAdjacencyMap<TContext, TEvent>(machine, options);
//   const pathMap: PathMap<TContext, TEvent> = {};
//   const visited: Set<string> = new Set();

//   function util(state: State<TContext>): PathMap<TContext, TEvent> {
//     const stateKey = serializeState(state);
//     visited.add(stateKey);
//     const eventMap = adjacency[stateKey];

//     for (const eventType of keys(eventMap)) {
//       const { value, context } = eventMap[eventType];

//       if (!value) {
//         continue;
//       }

//       const nextState = State.from(value, context);
//       const nextStateId = serializeState(nextState);

//       if (
//         !pathMap[nextStateId] ||
//         pathMap[nextStateId].length > pathMap[stateKey].length + 1
//       ) {
//         pathMap[nextStateId] = [
//           ...(pathMap[stateKey] || []),
//           {
//             state: { value, context: state.context },
//             event: deserializeEventString(eventType) as TEvent
//           }
//         ];
//       }

//       if (visited.has(nextStateId)) {
//         continue;
//       }

//       util(nextState);
//     }

//     return pathMap;
//   }

//   util(machine.initialState);

//   return pathMap;
// }

// export function getShortestPathsAsArray<
//   TContext = DefaultContext,
//   TEvent extends EventObject = EventObject
// >(
//   machine: StateNode<TContext, any, TEvent>
// ): Array<PathItem<TContext, TEvent>> {
//   const result = getShortestValuePaths<TContext, TEvent>(
//     machine,
//     defaultValueAdjMapOptions
//   );
//   return keys(result).map(key => ({
//     state: JSON.parse(key),
//     path: result[key]
//   }));
// }

export function getSimplePaths<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateMachine<TContext, any, TEvent>,
  options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
): PathsMap<TContext, TEvent> {
  const optionsWithDefaults = {
    ...defaultValueAdjMapOptions,
    ...options
  };

  const { stateSerializer } = optionsWithDefaults;

  if (!machine.states) {
    return EMPTY_MAP;
  }

  const adjacency = getAdjacencyMap(machine, optionsWithDefaults);
  const stateMap = new Map<string, State<TContext, TEvent>>();
  const visited = new Set();
  const path: Segments<TContext, TEvent> = [];
  const paths: PathsMap<TContext, TEvent> = {};

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
  machine: StateNode<TContext, any, TEvent>,
  options?: ValueAdjMapOptions<TContext, TEvent>
): Array<PathsItem<TContext, TEvent>> {
  const result = getSimplePaths(machine, options);
  return keys(result).map(key => result[key]);
}
