import type {
  Event,
  EventObject,
  AnyStateMachine,
  AnyState,
  StateFrom,
  EventFrom
} from 'xstate';
import { isMachine } from 'xstate/lib/utils';
import { getAdjacencyMap } from './adjacency';
import type {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  StatePlan,
  Steps,
  DirectedGraphEdge,
  DirectedGraphNode,
  TraversalOptions,
  AnyStateNode,
  TraversalConfig
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

export function createDefaultMachineOptions<TMachine extends AnyStateMachine>(
  machine: TMachine
): TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>> {
  return {
    serializeState: serializeMachineState,
    serializeEvent,
    eventCases: {},
    getEvents: (state) => {
      return state.nextEvents.map((type) => ({ type })) as EventFrom<TMachine>;
    },
    fromState: machine.initialState as StateFrom<TMachine>
  };
}

function createDefaultBehaviorOptions<
  TBehavior extends SimpleBehavior<any, any>
>(_behavior: TBehavior): TraversalOptions<any, any> {
  return {
    serializeState: (state) => JSON.stringify(state),
    serializeEvent,
    eventCases: {}
  };
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
  events: TEvent[],
  options?: TraversalOptions<TState, TEvent>
): StatePath<TState, TEvent> {
  const resolvedOptions = resolveTraversalOptions<TState, TEvent>(
    {
      getEvents: () => {
        return events;
      },
      ...options
    },
    isMachine(behavior)
      ? createDefaultMachineOptions(behavior)
      : createDefaultBehaviorOptions(behavior)
  );
  const fromState = resolvedOptions.fromState ?? behavior.initialState;

  const { serializeState, serializeEvent } = resolvedOptions;

  const adjacency = getAdjacencyMap(behavior, resolvedOptions);

  const stateMap = new Map<SerializedState, TState>();
  const path: Steps<TState, TEvent> = [];

  const initialSerializedState = serializeState(
    fromState,
    undefined,
    undefined
  ) as SerializedState;
  stateMap.set(initialSerializedState, fromState);

  let stateSerial = initialSerializedState;
  let state = fromState;
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

export interface AdjacencyMap<TState, TEvent> {
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

export function resolveTraversalOptions<TState, TEvent extends EventObject>(
  traversalOptions?: TraversalOptions<TState, TEvent>,
  defaultOptions?: TraversalOptions<TState, TEvent>
): TraversalConfig<TState, TEvent> {
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
    fromState: undefined,
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

export function joinPaths<TState, TEvent extends EventObject>(
  path1: StatePath<TState, TEvent>,
  path2: StatePath<TState, TEvent>
): StatePath<TState, TEvent> {
  const secondPathSource = path2.steps[0]?.state ?? path2.state;

  if (secondPathSource !== path1.state) {
    throw new Error(`Paths cannot be joined`);
  }

  return {
    state: path2.state,
    steps: path1.steps.concat(path2.steps),
    weight: path1.weight + path2.weight
  };
}
