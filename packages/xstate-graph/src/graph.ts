import type {
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
    return { type: event } as unknown as TEvent;
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
  machine: TMachine,
  options?: TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>>
): TraversalOptions<StateFrom<TMachine>, EventFrom<TMachine>> {
  const { events: getEvents, ...otherOptions } = options ?? {};
  const traversalOptions: TraversalOptions<
    StateFrom<TMachine>,
    EventFrom<TMachine>
  > = {
    serializeState: serializeMachineState,
    serializeEvent,
    events: (state) => {
      const events =
        typeof getEvents === 'function' ? getEvents(state) : getEvents ?? [];
      return flatten(
        state.nextEvents.map((type) => {
          const matchingEvents = events.filter(
            (ev) => (ev as any).type === type
          );
          if (matchingEvents.length) {
            return matchingEvents;
          }
          return [{ type }];
        })
      ) as any[];
    },
    fromState: machine.initialState as StateFrom<TMachine>,
    ...otherOptions
  };

  return traversalOptions;
}

export function createDefaultBehaviorOptions<
  TBehavior extends SimpleBehavior<any, any>
>(_behavior: TBehavior): TraversalOptions<any, any> {
  return {
    serializeState: (state) => JSON.stringify(state),
    serializeEvent
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

export interface AdjacencyValue<TState, TEvent> {
  state: TState;
  transitions: {
    [key: SerializedEvent]: {
      event: TEvent;
      state: TState;
    };
  };
}

export interface AdjacencyMap<TState, TEvent> {
  [key: SerializedState]: AdjacencyValue<TState, TEvent>;
}

export function resolveTraversalOptions<TState, TEvent extends EventObject>(
  traversalOptions?: TraversalOptions<TState, TEvent>,
  defaultOptions?: TraversalOptions<TState, TEvent>
): TraversalConfig<TState, TEvent> {
  const serializeState =
    traversalOptions?.serializeState ??
    defaultOptions?.serializeState ??
    ((state) => JSON.stringify(state));
  const traversalConfig: TraversalConfig<TState, TEvent> = {
    serializeState,
    serializeEvent,
    filter: () => true,
    events: [],
    traversalLimit: Infinity,
    fromState: undefined,
    toState: undefined,
    // Traversal should not continue past the `toState` predicate
    // since the target state has already been reached at that point
    stopCondition: traversalOptions?.toState,
    ...defaultOptions,
    ...traversalOptions
  };

  return traversalConfig;
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
