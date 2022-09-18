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
  StatePlan,
  ValueAdjacencyMap,
  ValueAdjacencyMapOptions,
  DirectedGraphEdge,
  DirectedGraphNode,
  TraversalOptions,
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

export function getMachineAdjacencyMap<TMachine extends AnyStateMachine>(
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

export const defaultMachineStateOptions: TraversalOptions<
  State<any, any>,
  any
> = {
  serializeState: serializeMachineState,
  serializeEvent,
  eventCases: {},
  getEvents: (state) => {
    return state.nextEvents.map((type) => ({ type }));
  }
};

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

export interface AdjacencyMap<TState, TEvent> {
  [key: SerializedState]: AdjacencyValue<TState, TEvent>;
}

export interface AdjacencyValue<TState, TEvent> {
  state: TState;
  transitions: {
    [key: SerializedEvent]: {
      event: TEvent;
      state: TState;
    };
  };
}

export function resolveTraversalOptions<TState, TEvent extends EventObject>(
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

export function filterPlans<TState, TEvent extends EventObject>(
  plans: Array<StatePlan<TState, TEvent>>,
  predicate: (state: TState, plan: StatePlan<TState, TEvent>) => boolean
): Array<StatePlan<TState, TEvent>> {
  const filteredPlans = plans.filter((plan) => predicate(plan.state, plan));

  return filteredPlans;
}
