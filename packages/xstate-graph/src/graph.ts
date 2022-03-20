import {
  State,
  DefaultContext,
  Event,
  EventObject,
  StateMachine,
  AnyStateMachine,
  AnyState,
  StateFrom,
  EventFrom
} from 'xstate';
import {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  StatePlan
} from '.';
import {
  StatePathsMap,
  AdjacencyMap,
  Steps,
  ValueAdjMapOptions,
  DirectedGraphEdge,
  DirectedGraphNode,
  TraversalOptions,
  VisitedContext,
  AnyStateNode
} from './types';

function flatten<T>(array: Array<T | T[]>): T[] {
  return ([] as T[]).concat(...array);
}

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
  stateNode: AnyStateNode | AnyStateMachine
): AnyStateNode[] {
  const { states } = stateNode;
  const nodes = Object.keys(states).reduce((accNodes, stateKey) => {
    const childStateNode = states[stateKey];
    const childStateNodes = getStateNodes(childStateNode);

    accNodes.push(childStateNode, ...childStateNodes);
    return accNodes;
  }, [] as AnyStateNode[]);

  return nodes;
}

export function getChildren(stateNode: AnyStateNode): AnyStateNode[] {
  if (!stateNode.states) {
    return [];
  }

  const children = Object.keys(stateNode.states).map((key) => {
    return stateNode.states[key];
  });

  return children;
}

export function serializeState(state: AnyState): SerializedState {
  const { value, context, actions } = state;
  return [value, context, actions.map((a) => a.type).join(',')]
    .map((x) => JSON.stringify(x))
    .join(' | ') as SerializedState;
}

export function serializeEvent<TEvent extends EventObject>(
  event: TEvent
): SerializedEvent {
  return JSON.stringify(event) as SerializedEvent;
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

export function getAdjacencyMap<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: ValueAdjMapOptions<StateFrom<TMachine>, EventFrom<TMachine>>
): AdjacencyMap<StateFrom<TMachine>, EventFrom<TMachine>> {
  type TState = StateFrom<TMachine>;
  type TEvent = EventFrom<TMachine>;

  const optionsWithDefaults = getValueAdjMapOptions(options);
  const { filter, stateSerializer, eventSerializer } = optionsWithDefaults;
  const { events } = optionsWithDefaults;

  const adjacency: AdjacencyMap<TState, TEvent> = {};

  function findAdjacencies(state: TState) {
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
      let nextState: TState;
      try {
        nextState = machine.transition(state, event) as TState;
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

  findAdjacencies(machine.initialState as TState);

  return adjacency;
}

const defaultMachineStateOptions: TraversalOptions<State<any, any>, any> = {
  serializeState,
  serializeEvent,
  getEvents: (state) => {
    return state.nextEvents.map((type) => ({ type }));
  }
};

export function getShortestPaths<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: Partial<TraversalOptions<AnyState, EventObject>>
): StatePathsMap<AnyState, EventObject> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    defaultMachineStateOptions
  );
  return traverseShortestPaths(
    {
      transition: (state, event) => machine.transition(state, event),
      initialState: machine.initialState
    },
    resolvedOptions
  );
}

export function traverseShortestPaths<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options?: Partial<TraversalOptions<TState, TEvent>>
): StatePathsMap<TState, TEvent> {
  const optionsWithDefaults = resolveTraversalOptions(options);
  const { serializeState } = optionsWithDefaults;

  const adjacency = performDepthFirstTraversal(behavior, optionsWithDefaults);

  // weight, state, event
  const weightMap = new Map<
    SerializedState,
    [number, SerializedState | undefined, SerializedEvent | undefined]
  >();
  const stateMap = new Map<SerializedState, TState>();
  const initialSerializedState = serializeState(behavior.initialState, null);
  stateMap.set(initialSerializedState, behavior.initialState);

  weightMap.set(initialSerializedState, [0, undefined, undefined]);
  const unvisited = new Set<SerializedState>();
  const visited = new Set<string>();

  unvisited.add(initialSerializedState);
  while (unvisited.size > 0) {
    for (const serializedState of unvisited) {
      const [weight] = weightMap.get(serializedState)!;
      for (const event of Object.keys(
        adjacency[serializedState].transitions
      ) as SerializedEvent[]) {
        const eventObject = JSON.parse(event);
        const nextState = adjacency[serializedState].transitions[event];
        const nextSerializedState = serializeState(nextState, eventObject);
        stateMap.set(nextSerializedState, nextState);
        if (!weightMap.has(nextSerializedState)) {
          weightMap.set(nextSerializedState, [
            weight + 1,
            serializedState,
            event
          ]);
        } else {
          const [nextWeight] = weightMap.get(nextSerializedState)!;
          if (nextWeight > weight + 1) {
            weightMap.set(nextSerializedState, [
              weight + 1,
              serializedState,
              event
            ]);
          }
        }
        if (!visited.has(nextSerializedState)) {
          unvisited.add(nextSerializedState);
        }
      }
      visited.add(serializedState);
      unvisited.delete(serializedState);
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
  options?: Partial<TraversalOptions<State<TContext, TEvent>, TEvent>>
): StatePathsMap<State<TContext, TEvent>, TEvent> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    defaultMachineStateOptions
  );

  return traverseSimplePaths(
    machine as SimpleBehavior<any, any>,
    resolvedOptions
  );
}

export function toDirectedGraph(stateNode: AnyStateNode): DirectedGraphNode {
  const edges: DirectedGraphEdge[] = flatten(
    stateNode.transitions.map((t, transitionIndex) => {
      const targets = t.target ? t.target : [stateNode];

      return targets.map((target, targetIndex) => {
        const edge: DirectedGraphEdge = {
          id: `${stateNode.id}:${transitionIndex}:${targetIndex}`,
          source: stateNode as AnyStateNode,
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
    stateNode: stateNode as AnyStateNode,
    children: getChildren(stateNode as AnyStateNode).map(toDirectedGraph),
    edges,
    toJSON: () => {
      const { id, children, edges: graphEdges } = graph;
      return { id, children, edges: graphEdges };
    }
  };

  return graph;
}

export function getPathFromEvents<
  TState,
  TEvent extends EventObject = EventObject
>(
  behavior: SimpleBehavior<TState, TEvent>,
  events: TEvent[]
): StatePath<TState, TEvent> {
  const optionsWithDefaults = resolveTraversalOptions<TState, TEvent>(
    {
      getEvents: () => {
        return events;
      }
    },
    defaultMachineStateOptions as any
  );

  const { serializeState } = optionsWithDefaults;

  const adjacency = performDepthFirstTraversal(behavior, optionsWithDefaults);

  const stateMap = new Map<string, TState>();
  const path: Steps<TState, TEvent> = [];

  const initialStateSerial = serializeState(behavior.initialState, null);
  stateMap.set(initialStateSerial, behavior.initialState);

  let stateSerial = initialStateSerial;
  let state = behavior.initialState;
  for (const event of events) {
    path.push({
      state: stateMap.get(stateSerial)!,
      event
    });

    const eventSerial = serializeEvent(event);
    const nextState = adjacency[stateSerial].transitions[eventSerial];

    if (!nextState) {
      throw new Error(
        `Invalid transition from ${stateSerial} with ${eventSerial}`
      );
    }

    const nextStateSerial = serializeState(nextState, event);
    stateMap.set(nextStateSerial, nextState);

    stateSerial = nextStateSerial;
    state = nextState;
  }

  return {
    state,
    steps: path,
    weight: path.length
  };
}

interface AdjMap<TState> {
  [key: SerializedState]: {
    state: TState;
    transitions: { [key: SerializedEvent]: TState };
  };
}

export function performDepthFirstTraversal<TState, TEvent>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): AdjMap<TState> {
  const { transition, initialState } = behavior;
  const {
    serializeState,
    getEvents,
    traversalLimit: limit
  } = resolveTraversalOptions(options);
  const adj: AdjMap<TState> = {};

  let iterations = 0;
  const queue: Array<[TState, TEvent | null]> = [[initialState, null]];

  while (queue.length) {
    const [state, event] = queue.shift()!;

    if (iterations++ > limit) {
      throw new Error('Traversal limit exceeded');
    }

    const serializedState = serializeState(state, event);
    if (adj[serializedState]) {
      continue;
    }

    adj[serializedState] = {
      state,
      transitions: {}
    };

    const events = getEvents(state);

    for (const subEvent of events) {
      const nextState = transition(state, subEvent);

      if (!options.filter || options.filter(nextState, subEvent)) {
        adj[serializedState].transitions[JSON.stringify(subEvent)] = nextState;
        queue.push([nextState, subEvent]);
      }
    }
  }

  return adj;
}

function resolveTraversalOptions<TState, TEvent>(
  traversalOptions?: Partial<TraversalOptions<TState, TEvent>>,
  defaultOptions?: TraversalOptions<TState, TEvent>
): Required<TraversalOptions<TState, TEvent>> {
  const serializeState =
    traversalOptions?.serializeState ??
    defaultOptions?.serializeState ??
    ((state) => JSON.stringify(state) as any);
  return {
    serializeState,
    serializeEvent: serializeEvent as any, // TODO fix types
    filter: () => true,
    visitCondition: (state, event, vctx) => {
      return vctx.vertices.has(serializeState(state, event));
    },
    getEvents: () => [],
    traversalLimit: Infinity,
    ...defaultOptions,
    ...traversalOptions
  };
}

export function traverseSimplePaths<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: Partial<TraversalOptions<TState, TEvent>>
): StatePathsMap<TState, TEvent> {
  const { initialState } = behavior;
  const resolvedOptions = resolveTraversalOptions(options);
  const { serializeState, visitCondition } = resolvedOptions;
  const adjacency = performDepthFirstTraversal(behavior, resolvedOptions);
  const stateMap = new Map<string, TState>();
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
      for (const serializedEvent of Object.keys(
        adjacency[fromStateSerial].transitions
      ) as SerializedEvent[]) {
        const subEvent = JSON.parse(serializedEvent);
        const nextState =
          adjacency[fromStateSerial].transitions[serializedEvent];

        if (!(serializedEvent in adjacency[fromStateSerial].transitions)) {
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

  for (const nextStateSerial of Object.keys(adjacency) as SerializedState[]) {
    util(initialState, nextStateSerial, null);
  }

  return pathMap;
}

export function filterPlans<TState, TEvent extends EventObject>(
  plans: StatePathsMap<TState, TEvent>,
  predicate: (state: TState, plan: StatePlan<TState, TEvent>) => boolean
): Array<StatePlan<TState, TEvent>> {
  const filteredPlans = Object.values(plans).filter((plan) =>
    predicate(plan.state, plan)
  );

  return filteredPlans;
}

export function traverseSimplePathsTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  predicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = traverseSimplePaths(behavior, resolvedOptions);

  return filterPlans(simplePlansMap, predicate);
}

export function traverseSimplePathsFromTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  fromPredicate: (state: TState) => boolean,
  toPredicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = traverseSimplePaths(behavior, resolvedOptions);

  // Return all plans that contain a "from" state and target a "to" state
  return filterPlans(simplePlansMap, (state, plan) => {
    return (
      toPredicate(state) && plan.paths.some((path) => fromPredicate(path.state))
    );
  });
}

export function traverseShortestPathsTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  predicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = traverseShortestPaths(behavior, resolvedOptions);

  return filterPlans(simplePlansMap, predicate);
}

export function traverseShortestPathsFromTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  fromPredicate: (state: TState) => boolean,
  toPredicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const shortesPlansMap = traverseShortestPaths(behavior, resolvedOptions);

  // Return all plans that contain a "from" state and target a "to" state
  return filterPlans(shortesPlansMap, (state, plan) => {
    return (
      toPredicate(state) && plan.paths.some((path) => fromPredicate(path.state))
    );
  });
}
