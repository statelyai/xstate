import {
  StateNode,
  State,
  DefaultContext,
  Event,
  EventObject,
  StateMachine,
  AnyEventObject,
  AnyStateMachine
} from 'xstate';
import { flatten, keys } from 'xstate/lib/utils';
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
  const nodes = keys(states).reduce((accNodes, stateKey) => {
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

const defaultMachineStateOptions: TraversalOptions<State<any, any>, any> = {
  serializeState,
  serializeEvent,
  getEvents: (state) => {
    return state.nextEvents.map((type) => ({ type }));
  }
};

export function getShortestPaths<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateMachine<TContext, any, TEvent>,
  options?: TraversalOptions<State<TContext, TEvent>, TEvent>
): StatePathsMap<State<TContext, TEvent>, TEvent> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    defaultMachineStateOptions
  );
  return depthShortestPaths(
    {
      transition: (state, event) => machine.transition(state, event),
      initialState: machine.initialState
    },
    resolvedOptions
  );
}

export function depthShortestPaths<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options?: TraversalOptions<TState, TEvent>
): StatePathsMap<TState, TEvent> {
  const optionsWithDefaults = resolveTraversalOptions(options);
  const { serializeState } = optionsWithDefaults;

  const adjacency = depthFirstTraversal(behavior, optionsWithDefaults);

  // weight, state, event
  const weightMap = new Map<
    SerializedState,
    [number, SerializedState | undefined, SerializedEvent | undefined]
  >();
  const stateMap = new Map<SerializedState, TState>();
  const initialVertex = serializeState(behavior.initialState, null);
  stateMap.set(initialVertex, behavior.initialState);

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
  options?: TraversalOptions<State<TContext, TEvent>, TEvent>
): StatePathsMap<State<TContext, TEvent>, TEvent> {
  const resolvedOptions = resolveTraversalOptions(
    options,
    defaultMachineStateOptions
  );

  return depthSimplePaths(machine as SimpleBehavior<any, any>, resolvedOptions);
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

  const adjacency = depthFirstTraversal(behavior, optionsWithDefaults);

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
    const nextState = adjacency[stateSerial][eventSerial];

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
  [key: SerializedState]: { [key: SerializedEvent]: TState };
}

export function depthFirstTraversal<TState, TEvent>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): AdjMap<TState> {
  const { transition, initialState } = behavior;
  const { serializeState, getEvents } = resolveTraversalOptions(options);
  const adj: AdjMap<TState> = {};

  function util(state: TState, event: TEvent | null) {
    const serializedState = serializeState(state, event);
    if (adj[serializedState]) {
      return;
    }

    adj[serializedState] = {};

    const events = getEvents(state);

    for (const subEvent of events) {
      const nextState = transition(state, subEvent);

      if (!options.filter || options.filter(nextState, subEvent)) {
        adj[serializedState][JSON.stringify(subEvent)] = nextState;
        util(nextState, subEvent);
      }
    }
  }

  util(initialState, null);

  return adj;
}

function resolveTraversalOptions<TState, TEvent>(
  depthOptions?: Partial<TraversalOptions<TState, TEvent>>,
  defaultOptions?: TraversalOptions<TState, TEvent>
): Required<TraversalOptions<TState, TEvent>> {
  const serializeState =
    depthOptions?.serializeState ??
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
    ...defaultOptions,
    ...depthOptions
  };
}

export function depthSimplePaths<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): StatePathsMap<TState, TEvent> {
  const { initialState } = behavior;
  const resolvedOptions = resolveTraversalOptions(options);
  const { serializeState, visitCondition } = resolvedOptions;
  const adjacency = depthFirstTraversal(behavior, resolvedOptions);
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

export function filterPlans<TState, TEvent extends EventObject>(
  plans: StatePathsMap<TState, TEvent>,
  predicate: (state: TState, plan: StatePlan<TState, TEvent>) => boolean
): Array<StatePlan<TState, TEvent>> {
  const filteredPlans = Object.values(plans).filter((plan) =>
    predicate(plan.state, plan)
  );

  return filteredPlans;
}

export function depthSimplePathsTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  predicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = depthSimplePaths(behavior, resolvedOptions);

  return filterPlans(simplePlansMap, predicate);
}

export function depthSimplePathsFromTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  fromPredicate: (state: TState) => boolean,
  toPredicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = depthSimplePaths(behavior, resolvedOptions);

  // Return all plans that contain a "from" state and target a "to" state
  return filterPlans(simplePlansMap, (state, plan) => {
    return (
      toPredicate(state) && plan.paths.some((path) => fromPredicate(path.state))
    );
  });
}

export function depthShortestPathsTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  predicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const simplePlansMap = depthShortestPaths(behavior, resolvedOptions);

  return filterPlans(simplePlansMap, predicate);
}

export function depthShortestPathsFromTo<TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  fromPredicate: (state: TState) => boolean,
  toPredicate: (state: TState) => boolean,
  options: TraversalOptions<TState, TEvent>
): Array<StatePlan<TState, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(options);
  const shortesPlansMap = depthShortestPaths(behavior, resolvedOptions);

  // Return all plans that contain a "from" state and target a "to" state
  return filterPlans(shortesPlansMap, (state, plan) => {
    return (
      toPredicate(state) && plan.paths.some((path) => fromPredicate(path.state))
    );
  });
}

// type EventCases<TEvent extends EventObject> = Array<
//   Omit<TEvent, 'type'> & { type?: TEvent['type'] }
// >;

// export function generateEvents<TState, TEvent extends EventObject>(
//   blah: {
//     [K in TEvent['type']]: TEvent extends { type: K }
//       ? EventCases<TEvent> | ((state: TState) => EventCases<TEvent>)
//       : never;
//   }
// ): (state: TState) => TEvent[] {
//   return (state) => {
//     const events: TEvent[] = [];

//     Object.keys(blah).forEach((key) => {
//       const cases = blah[key as TEvent['type']];

//       const foo =
//         typeof cases === 'function' ? cases(state) : (cases as TEvent[]);

//       foo.forEach((payload) => {
//         events.push({
//           type: key,
//           ...payload
//         });
//       });
//     });

//     return events;
//   };
// }
