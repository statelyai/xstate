import type {
  State,
  Event,
  EventObject,
  AnyStateMachine,
  AnyState,
  StateFrom,
  EventFrom
} from 'xstate';
import type {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  StatePlan,
  StatePlanMap,
  ValueAdjacencyMap,
  Steps,
  ValueAdjacencyMapOptions,
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

export function serializeMachineState(state: AnyState): SerializedState {
  const { value, context } = state;
  return JSON.stringify({ value, context }) as SerializedState;
}

export function serializeEvent<TEvent extends EventObject>(
  event: TEvent
): SerializedEvent {
  return JSON.stringify(event) as SerializedEvent;
}

const defaultValueAdjacencyMapOptions: Required<
  ValueAdjacencyMapOptions<any, any>
> = {
  events: {},
  filter: () => true,
  serializeState: serializeMachineState,
  serializeEvent
};

function getValueAdjacencyMapOptions<TState, TEvent extends EventObject>(
  options?: ValueAdjacencyMapOptions<TState, TEvent>
): Required<ValueAdjacencyMapOptions<TState, TEvent>> {
  return {
    ...(defaultValueAdjacencyMapOptions as Required<
      ValueAdjacencyMapOptions<TState, TEvent>
    >),
    ...options
  };
}

export function getValueAdjacencyMap<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: ValueAdjacencyMapOptions<StateFrom<TMachine>, EventFrom<TMachine>>
): ValueAdjacencyMap<StateFrom<TMachine>, EventFrom<TMachine>> {
  type TState = StateFrom<TMachine>;
  type TEvent = EventFrom<TMachine>;

  const optionsWithDefaults = getValueAdjacencyMapOptions(options);
  const {
    filter,
    serializeState: stateSerializer,
    serializeEvent: eventSerializer
  } = optionsWithDefaults;
  const { events } = optionsWithDefaults;

  const adjacency: ValueAdjacencyMap<TState, TEvent> = {};

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
  serializeState: serializeMachineState,
  serializeEvent,
  eventCases: {},
  getEvents: (state) => {
    return state.nextEvents.map((type) => ({ type }));
  }
};

export function getShortestPlans<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: Partial<TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>>
): Array<StatePlan<StateFrom<TMachine>, EventFrom<TMachine>>> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    defaultMachineStateOptions
  );
  return traverseShortestPlans(
    {
      transition: (state, event) => machine.transition(state, event),
      initialState: machine.initialState
    },
    resolvedOptions
  ) as Array<StatePlan<StateFrom<TMachine>, EventFrom<TMachine>>>;
}

export function traverseShortestPlans<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options?: Partial<TraversalOptions<TState, TEvent>>
): Array<StatePlan<TState, TEvent>> {
  const optionsWithDefaults = resolveTraversalOptions(options);
  const serializeState = optionsWithDefaults.serializeState as (
    ...args: Parameters<typeof optionsWithDefaults.serializeState>
  ) => SerializedState;

  const adjacency = performDepthFirstTraversal(behavior, optionsWithDefaults);

  // weight, state, event
  const weightMap = new Map<
    SerializedState,
    [
      weight: number,
      state: SerializedState | undefined,
      event: TEvent | undefined
    ]
  >();
  const stateMap = new Map<SerializedState, TState>();
  const initialSerializedState = serializeState(
    behavior.initialState,
    undefined,
    undefined
  );
  stateMap.set(initialSerializedState, behavior.initialState);

  weightMap.set(initialSerializedState, [0, undefined, undefined]);
  const unvisited = new Set<SerializedState>();
  const visited = new Set<SerializedState>();

  unvisited.add(initialSerializedState);
  for (const serializedState of unvisited) {
    const [weight] = weightMap.get(serializedState)!;
    for (const event of Object.keys(
      adjacency[serializedState].transitions
    ) as SerializedEvent[]) {
      const { state: nextState, event: eventObject } = adjacency[
        serializedState
      ].transitions[event];
      const prevState = stateMap.get(serializedState);
      const nextSerializedState = serializeState(
        nextState,
        eventObject,
        prevState
      );
      stateMap.set(nextSerializedState, nextState);
      if (!weightMap.has(nextSerializedState)) {
        weightMap.set(nextSerializedState, [
          weight + 1,
          serializedState,
          eventObject
        ]);
      } else {
        const [nextWeight] = weightMap.get(nextSerializedState)!;
        if (nextWeight > weight + 1) {
          weightMap.set(nextSerializedState, [
            weight + 1,
            serializedState,
            eventObject
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

  const statePlanMap: StatePlanMap<TState, TEvent> = {};

  weightMap.forEach(([weight, fromState, fromEvent], stateSerial) => {
    const state = stateMap.get(stateSerial)!;
    statePlanMap[stateSerial] = {
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
              steps: statePlanMap[fromState].paths[0].steps.concat({
                state: stateMap.get(fromState)!,
                event: fromEvent!
              }),
              weight
            }
          ]
    };
  });

  return Object.values(statePlanMap);
}

export function getSimplePlans<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: Partial<TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>>
): Array<StatePlan<StateFrom<TMachine>, EventFrom<TMachine>>> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    defaultMachineStateOptions
  );

  return traverseSimplePlans(
    machine as SimpleBehavior<any, any>,
    resolvedOptions
  );
}

export function toDirectedGraph(
  stateNode: AnyStateNode | AnyStateMachine
): DirectedGraphNode {
  const edges: DirectedGraphEdge[] = flatten(
    stateNode.transitions.map((t, transitionIndex) => {
      const targets = t.target ? t.target : [stateNode];

      return targets.map((target, targetIndex) => {
        const edge: DirectedGraphEdge = {
          id: `${stateNode.id}:${transitionIndex}:${targetIndex}`,
          source: stateNode as AnyStateNode,
          target: target as AnyStateNode,
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

  const { serializeState, serializeEvent } = optionsWithDefaults;

  const adjacency = performDepthFirstTraversal(behavior, optionsWithDefaults);

  const stateMap = new Map<SerializedState, TState>();
  const path: Steps<TState, TEvent> = [];

  const initialSerializedState = serializeState(
    behavior.initialState,
    undefined,
    undefined
  ) as SerializedState;
  stateMap.set(initialSerializedState, behavior.initialState);

  let stateSerial = initialSerializedState;
  let state = behavior.initialState;
  for (const event of events) {
    path.push({
      state: stateMap.get(stateSerial)!,
      event
    });

    const eventSerial = serializeEvent(event);
    const { state: nextState, event: _nextEvent } = adjacency[
      stateSerial
    ].transitions[eventSerial];

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

  return {
    state,
    steps: path,
    weight: path.length
  };
}

interface AdjacencyMap<TState, TEvent> {
  [key: SerializedState]: {
    state: TState;
    transitions: {
      [key: SerializedEvent]: {
        event: TEvent;
        state: TState;
      };
    };
  };
}

export function performDepthFirstTraversal<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): AdjacencyMap<TState, TEvent> {
  const { transition, initialState } = behavior;
  const {
    serializeEvent,
    serializeState,
    getEvents,
    eventCases,
    traversalLimit: limit
  } = resolveTraversalOptions(options);
  const adj: AdjacencyMap<TState, TEvent> = {};

  let iterations = 0;
  const queue: Array<
    [
      nextState: TState,
      event: TEvent | undefined,
      prevState: TState | undefined
    ]
  > = [[initialState, undefined, undefined]];
  const stateMap = new Map<SerializedState, TState>();

  while (queue.length) {
    const [state, event, prevState] = queue.shift()!;

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

    const events = getEvents(state, eventCases);

    for (const subEvent of events) {
      const nextState = transition(state, subEvent);

      if (!options.filter || options.filter(nextState, subEvent)) {
        adj[serializedState].transitions[
          serializeEvent(subEvent) as SerializedEvent
        ] = {
          event: subEvent,
          state: nextState
        };
        queue.push([nextState, subEvent, state]);
      }
    }
  }

  return adj;
}

function resolveTraversalOptions<TState, TEvent extends EventObject>(
  traversalOptions?: Partial<TraversalOptions<TState, TEvent>>,
  defaultOptions?: TraversalOptions<TState, TEvent>
): Required<TraversalOptions<TState, TEvent>> {
  const serializeState =
    traversalOptions?.serializeState ??
    defaultOptions?.serializeState ??
    ((state) => JSON.stringify(state));
  return {
    serializeState,
    serializeEvent,
    filter: () => true,
    eventCases: {},
    getEvents: () => [],
    traversalLimit: Infinity,
    ...defaultOptions,
    ...traversalOptions
  };
}

export function traverseSimplePlans<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: Partial<TraversalOptions<TState, TEvent>>
): Array<StatePlan<TState, TEvent>> {
  const { initialState } = behavior;
  const resolvedOptions = resolveTraversalOptions(options);
  const serializeState = resolvedOptions.serializeState as (
    ...args: Parameters<typeof resolvedOptions.serializeState>
  ) => SerializedState;
  const adjacency = performDepthFirstTraversal(behavior, resolvedOptions);
  const stateMap = new Map<SerializedState, TState>();
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
    fromStateSerial: SerializedState,
    toStateSerial: SerializedState
  ) {
    const fromState = stateMap.get(fromStateSerial)!;
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
        const { state: nextState, event: subEvent } = adjacency[
          fromStateSerial
        ].transitions[serializedEvent];

        if (!(serializedEvent in adjacency[fromStateSerial].transitions)) {
          continue;
        }
        const prevState = stateMap.get(fromStateSerial);

        const nextStateSerial = serializeState(nextState, subEvent, prevState);
        stateMap.set(nextStateSerial, nextState);

        if (!visitCtx.vertices.has(nextStateSerial)) {
          visitCtx.edges.add(serializedEvent);
          path.push({
            state: stateMap.get(fromStateSerial)!,
            event: subEvent
          });
          util(nextStateSerial, toStateSerial);
        }
      }
    }

    path.pop();
    visitCtx.vertices.delete(fromStateSerial);
  }

  const initialStateSerial = serializeState(initialState, undefined);
  stateMap.set(initialStateSerial, initialState);

  for (const nextStateSerial of Object.keys(adjacency) as SerializedState[]) {
    util(initialStateSerial, nextStateSerial);
  }

  return Object.values(pathMap);
}

function filterPlans<TState, TEvent extends EventObject>(
  plans: Array<StatePlan<TState, TEvent>>,
  predicate: (state: TState, plan: StatePlan<TState, TEvent>) => boolean
): Array<StatePlan<TState, TEvent>> {
  const filteredPlans = plans.filter((plan) => predicate(plan.state, plan));

  return filteredPlans;
}

export function traverseSimplePathsTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  predicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = traverseSimplePlans(behavior, resolvedOptions);

  return filterPlans(simplePlansMap, predicate);
}

export function traverseSimplePathsFromTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  fromPredicate: (state: TState) => boolean,
  toPredicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = traverseSimplePlans(behavior, resolvedOptions);

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
  const simplePlansMap = traverseShortestPlans(behavior, resolvedOptions);

  return filterPlans(simplePlansMap, predicate);
}

export function traverseShortestPathsFromTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  fromPredicate: (state: TState) => boolean,
  toPredicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const shortesPlansMap = traverseShortestPlans(behavior, resolvedOptions);

  // Return all plans that contain a "from" state and target a "to" state
  return filterPlans(shortesPlansMap, (state, plan) => {
    return (
      toPredicate(state) && plan.paths.some((path) => fromPredicate(path.state))
    );
  });
}
