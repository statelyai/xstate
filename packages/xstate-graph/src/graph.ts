import {
  StateNode,
  State,
  DefaultContext,
  Event,
  EventObject,
  StateMachine,
  AnyEventObject
} from 'xstate';
import { flatten, keys } from 'xstate/lib/utils';
import { SerializedEvent, SerializedState, StatePath } from '.';
import {
  StatePathsMap,
  AdjacencyMap,
  Steps,
  ValueAdjMapOptions,
  DirectedGraphEdge,
  DirectedGraphNode
} from './types';

export function toEventObject<TEvent extends EventObject>(
  event: Event<TEvent>
): TEvent {
  if (typeof event === 'string' || typeof event === 'number') {
    return ({ type: event } as unknown) as TEvent;
  }

  return event;
}

/**
 * Returns all state nodes of the given `node`.
 * @param stateNode State node to recursively get child state nodes from
 */
export function getStateNodes(
  stateNode: StateNode | StateMachine<any, any, any>
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

export function getChildren(stateNode: StateNode): StateNode[] {
  if (!stateNode.states) {
    return [];
  }

  const children = Object.keys(stateNode.states).map((key) => {
    return stateNode.states[key];
  });

  return children;
}

export function serializeState<TContext>(
  state: State<TContext, any>
): SerializedState {
  const { value, context } = state;
  return (context === undefined
    ? JSON.stringify(value)
    : JSON.stringify(value) +
      ' | ' +
      JSON.stringify(context)) as SerializedState;
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

const defaultValueAdjMapOptions: Required<ValueAdjMapOptions<any, any>> = {
  events: {},
  filter: () => true,
  stateSerializer: serializeState,
  eventSerializer: serializeEvent
};

function getValueAdjMapOptions<TState, TEvent extends EventObject>(
  options?: ValueAdjMapOptions<TState, TEvent>
): Required<ValueAdjMapOptions<TState, TEvent>> {
  return {
    ...(defaultValueAdjMapOptions as Required<
      ValueAdjMapOptions<TState, TEvent>
    >),
    ...options
  };
}

export function getAdjacencyMap<
  TContext = DefaultContext,
  TEvent extends EventObject = AnyEventObject
>(
  machine:
    | StateNode<TContext, any, TEvent>
    | StateMachine<TContext, any, TEvent>,
  options?: ValueAdjMapOptions<State<TContext, TEvent>, TEvent>
): AdjacencyMap<State<TContext, TEvent>, TEvent> {
  const optionsWithDefaults = getValueAdjMapOptions(options);
  const { filter, stateSerializer, eventSerializer } = optionsWithDefaults;
  const { events } = optionsWithDefaults;

  const adjacency: AdjacencyMap<State<TContext, TEvent>, TEvent> = {};

  function findAdjacencies(state: State<TContext, TEvent>) {
    const { nextEvents } = state;
    const stateHash = stateSerializer(state);

    if (adjacency[stateHash]) {
      return;
    }

    adjacency[stateHash] = {};

    const potentialEvents = flatten<TEvent>(
      nextEvents.map((nextEvent) => {
        const getNextEvents = events[nextEvent];

        if (!getNextEvents) {
          return [{ type: nextEvent }];
        }

        if (typeof getNextEvents === 'function') {
          return getNextEvents(state);
        }

        return getNextEvents;
      })
    ).map((event) => toEventObject(event));

    for (const event of potentialEvents) {
      let nextState: State<TContext, TEvent>;
      try {
        nextState = machine.transition(state, event);
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

  findAdjacencies(machine.initialState);

  return adjacency;
}

export function getShortestPaths<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateMachine<TContext, any, TEvent>,
  _events: TEvent[] = machine.events.map((type) => ({ type })) as TEvent[],
  options: TraversalOptions<State<TContext, TEvent>, TEvent> = {
    serializeState
  }
): StatePathsMap<State<TContext, TEvent>, TEvent> {
  return depthShortestPaths(
    (state, event) => machine.transition(state, event),
    machine.initialState,
    _events,
    options
  );
}

export function depthShortestPaths<TState, TEvent extends EventObject>(
  reducer: (state: TState, event: TEvent) => TState,
  initialState: TState,
  events: TEvent[],
  options?: TraversalOptions<TState, TEvent>
): StatePathsMap<TState, TEvent> {
  const optionsWithDefaults = resolveTraversalOptions(options);
  const { serializeState } = optionsWithDefaults;

  const adjacency = depthFirstTraversal(
    reducer,
    initialState,
    events,
    optionsWithDefaults
  );

  // weight, state, event
  const weightMap = new Map<
    SerializedState,
    [number, SerializedState | undefined, SerializedEvent | undefined]
  >();
  const stateMap = new Map<SerializedState, TState>();
  const initialVertex = serializeState(initialState, null);
  stateMap.set(initialVertex, initialState);

  weightMap.set(initialVertex, [0, undefined, undefined]);
  const unvisited = new Set<SerializedState>();
  const visited = new Set<string>();

  unvisited.add(initialVertex);
  while (unvisited.size > 0) {
    for (const vertex of unvisited) {
      const [weight] = weightMap.get(vertex)!;
      for (const event of keys(adjacency[vertex])) {
        const eventObject = JSON.parse(event);
        const nextState = adjacency[vertex][event];
        const nextVertex = serializeState(nextState, eventObject);
        stateMap.set(nextVertex, nextState);
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

  const statePathMap: StatePathsMap<TState, TEvent> = {};

  weightMap.forEach(([weight, fromState, fromEvent], stateSerial) => {
    const state = stateMap.get(stateSerial)!;
    statePathMap[stateSerial] = {
      state,
      paths: !fromState
        ? [
            {
              state,
              steps: [],
              weight
            }
          ]
        : [
            {
              state,
              steps: statePathMap[fromState].paths[0].steps.concat({
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
  machine: StateMachine<TContext, any, TEvent>,
  _events: TEvent[] = machine.events.map((type) => ({ type })) as TEvent[],
  options: TraversalOptions<State<TContext, TEvent>, TEvent> = {
    serializeState
  }
): StatePathsMap<State<TContext, TEvent>, TEvent> {
  return depthSimplePaths(
    (state, event) => machine.transition(state, event),
    machine.initialState,
    _events,
    options
  );
}

export function toDirectedGraph(stateNode: StateNode): DirectedGraphNode {
  const edges: DirectedGraphEdge[] = flatten(
    stateNode.transitions.map((t, transitionIndex) => {
      const targets = t.target ? t.target : [stateNode];

      return targets.map((target, targetIndex) => {
        const edge: DirectedGraphEdge = {
          id: `${stateNode.id}:${transitionIndex}:${targetIndex}`,
          source: stateNode,
          target,
          transition: t,
          label: {
            text: t.eventType,
            toJSON: () => ({ text: t.eventType })
          },
          toJSON: () => {
            const { label } = edge;

            return { source: stateNode.id, target: target.id, label };
          }
        };

        return edge;
      });
    })
  );

  const graph = {
    id: stateNode.id,
    stateNode,
    children: getChildren(stateNode).map((sn) => toDirectedGraph(sn)),
    edges,
    toJSON: () => {
      const { id, children, edges: graphEdges } = graph;
      return { id, children, edges: graphEdges };
    }
  };

  return graph;
}

export function getPathFromEvents<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateMachine<TContext, any, TEvent>,
  events: TEvent[]
): StatePath<State<TContext, TEvent>, TEvent> {
  const optionsWithDefaults = getValueAdjMapOptions<
    State<TContext, TEvent>,
    TEvent
  >({
    events: events.reduce((events, event) => {
      events[event.type] ??= [];
      events[event.type].push(event);
      return events;
    }, {})
  });

  const { stateSerializer, eventSerializer } = optionsWithDefaults;

  if (!machine.states) {
    return {
      state: machine.initialState,
      steps: [],
      weight: 0
    };
  }

  const adjacency = getAdjacencyMap(machine, optionsWithDefaults);
  const stateMap = new Map<string, State<TContext, TEvent>>();
  const path: Steps<State<TContext, TEvent>, TEvent> = [];

  const initialStateSerial = stateSerializer(machine.initialState);
  stateMap.set(initialStateSerial, machine.initialState);

  let stateSerial = initialStateSerial;
  let state = machine.initialState;
  for (const event of events) {
    path.push({
      state: stateMap.get(stateSerial)!,
      event
    });

    const eventSerial = eventSerializer(event);
    const nextSegment = adjacency[stateSerial][eventSerial];

    if (!nextSegment) {
      throw new Error(
        `Invalid transition from ${stateSerial} with ${eventSerial}`
      );
    }

    const nextStateSerial = stateSerializer(nextSegment.state);
    stateMap.set(nextStateSerial, nextSegment.state);

    stateSerial = nextStateSerial;
    state = nextSegment.state;
  }

  return {
    state,
    steps: path,
    weight: path.length
  };
}

interface AdjMap<TState> {
  [key: SerializedState]: { [key: SerializedEvent]: TState };
}

interface TraversalOptions<V, E> {
  serializeState?: (vertex: V, edge: E | null) => SerializedState;
  visitCondition?: (vertex: V, edge: E, vctx: VisitedContext<V, E>) => boolean;
  shortest?: boolean;
}

export function depthFirstTraversal<TState, TEvent>(
  reducer: (state: TState, event: TEvent) => TState,
  initialState: TState,
  events: TEvent[],
  options: TraversalOptions<TState, TEvent>
): AdjMap<TState> {
  const { serializeState: serializeState } = resolveTraversalOptions(options);
  const adj: AdjMap<TState> = {};

  function util(state: TState, event: TEvent | null) {
    const serializedState = serializeState(state, event);
    if (adj[serializedState]) {
      return;
    }

    adj[serializedState] = {};

    for (const subEvent of events) {
      const nextState = reducer(state, subEvent);
      adj[serializedState][JSON.stringify(subEvent)] = nextState;

      util(nextState, subEvent);
    }
  }

  util(initialState, null);

  return adj;
}

interface VisitedContext<V, E> {
  vertices: Set<string>;
  edges: Set<string>;
  a?: V | E; // TODO: remove
}

function resolveTraversalOptions<V, E>(
  depthOptions?: TraversalOptions<V, E>
): Required<TraversalOptions<V, E>> {
  const serializeState =
    depthOptions?.serializeState ?? ((state) => JSON.stringify(state) as any);
  const shortest = !!depthOptions?.shortest;
  return {
    shortest,
    serializeState,
    visitCondition: (state, event, vctx) => {
      return shortest ? false : vctx.vertices.has(serializeState(state, event));
    },
    ...depthOptions
  };
}

export function depthSimplePaths<TState, TEvent extends EventObject>(
  reducer: (state: TState, event: TEvent) => TState,
  initialState: TState,
  events: TEvent[],
  options: TraversalOptions<TState, TEvent>
): StatePathsMap<TState, TEvent> {
  const resolvedOptions = resolveTraversalOptions(options);
  const { serializeState, visitCondition } = resolvedOptions;
  const adjacency = depthFirstTraversal(
    reducer,
    initialState,
    events,
    resolvedOptions
  );
  const stateMap = new Map<string, TState>();
  // const visited = new Set();
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
    fromState: TState,
    toStateSerial: SerializedState,
    event: TEvent | null
  ) {
    const fromStateSerial = serializeState(fromState, event);
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
      for (const serializedEvent of keys(adjacency[fromStateSerial])) {
        const subEvent = JSON.parse(serializedEvent);
        const nextState = adjacency[fromStateSerial][serializedEvent];

        if (!(serializedEvent in adjacency[fromStateSerial])) {
          continue;
        }

        const nextStateSerial = serializeState(nextState, subEvent);
        stateMap.set(nextStateSerial, nextState);

        if (!visitCondition(nextState, subEvent, visitCtx)) {
          visitCtx.edges.add(serializedEvent);
          path.push({
            state: stateMap.get(fromStateSerial)!,
            event: deserializeEventString(serializedEvent)
          });
          util(nextState, toStateSerial, subEvent);
        }
      }
    }

    path.pop();
    visitCtx.vertices.delete(fromStateSerial);
  }

  const initialStateSerial = serializeState(initialState, null);
  stateMap.set(initialStateSerial, initialState);

  for (const nextStateSerial of keys(adjacency)) {
    util(initialState, nextStateSerial, null);
  }

  return pathMap;
}
