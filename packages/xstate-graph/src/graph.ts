import { StateNode, State } from 'xstate';
import { getActionType, flatten, keys } from 'xstate/lib/utils';
import {
  StateValue,
  Edge,
  Segment,
  PathMap,
  PathItem,
  PathsItem,
  PathsMap,
  AdjacencyMap,
  DefaultContext,
  ValueAdjacencyMap,
  Event,
  EventObject,
  StateMachine
} from 'xstate/lib/types';
import { toEventObject } from 'xstate/lib/actions';

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

export function getEventEdges<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(node: StateNode<TContext>, event: string): Array<Edge<TContext, TEvent>> {
  const transitions = node.definition.on[event];

  return flatten(
    transitions.map(transition => {
      const targets = transition.target
        ? ([] as string[]).concat(transition.target)
        : undefined;

      if (!targets) {
        return [
          {
            source: node,
            target: node,
            event,
            actions: transition.actions
              ? transition.actions.map(getActionType)
              : [],
            cond: transition.cond,
            transition
          }
        ];
      }

      return targets
        .map<Edge<TContext, TEvent> | undefined>(target => {
          try {
            const targetNode = target
              ? node.getRelativeStateNodes(target, undefined, false)[0]
              : node;

            return {
              source: node,
              target: targetNode,
              event,
              actions: transition.actions
                ? transition.actions.map(getActionType)
                : [],
              cond: transition.cond,
              transition
            };
          } catch (e) {
            // tslint:disable-next-line:no-console
            console.warn(`Target '${target}' not found on '${node.id}'`);
            return undefined;
          }
        })
        .filter(maybeEdge => maybeEdge !== undefined) as Array<
        Edge<TContext, TEvent>
      >;
    })
  );
}

export function getEdges<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  node: StateNode<TContext>,
  options?: { depth: null | number }
): Array<Edge<TContext, TEvent>> {
  const { depth = null } = options || {};
  const edges: Array<Edge<TContext, TEvent>> = [];

  if (node.states && depth === null) {
    keys(node.states).forEach(stateKey => {
      edges.push(...getEdges<TContext>(node.states[stateKey]));
    });
  } else if (depth && depth > 0) {
    keys(node.states).forEach(stateKey => {
      edges.push(
        ...getEdges<TContext>(node.states[stateKey], { depth: depth - 1 })
      );
    });
  }

  keys(node.on).forEach(event => {
    edges.push(...getEventEdges<TContext>(node, event));
  });

  return edges;
}

export function getAdjacencyMap<TContext = DefaultContext>(
  node: StateNode<TContext>,
  context?: TContext
): AdjacencyMap {
  const adjacency: AdjacencyMap = {};

  const events = node.events;

  function findAdjacencies(stateValue: StateValue) {
    const stateKey = JSON.stringify(stateValue);

    if (adjacency[stateKey]) {
      return;
    }

    adjacency[stateKey] = {};

    for (const event of events) {
      const nextState = node.transition(stateValue, event, context);
      adjacency[stateKey][event as string] = { state: nextState.value };

      findAdjacencies(nextState.value);
    }
  }

  findAdjacencies(node.initialState.value);

  return adjacency;
}

export function deserializeStateString(
  valueContextString: string
): { value: StateValue; context: any } {
  const [valueString, contextString] = valueContextString.split(' | ');

  return {
    value: JSON.parse(valueString),
    context: contextString === undefined ? undefined : JSON.parse(contextString)
  };
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

export class ValueAdjacency<TContext, TEvent extends EventObject> {
  public mapping: ValueAdjacencyMap<TContext, TEvent>;
  public options: ValueAdjMapOptions<TContext, TEvent>;

  constructor(
    public machine: StateMachine<TContext, any, TEvent>,
    options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
  ) {
    this.options = {
      events: {},
      stateSerializer: serializeState,
      eventSerializer: serializeEvent,
      ...options
    } as ValueAdjMapOptions<TContext, TEvent>;
    this.mapping = getValueAdjacencyMap(machine, options);
  }

  public reaches(stateValue: StateValue, context: TContext): boolean {
    const resolvedStateValue = this.machine.resolve(stateValue);
    const state = State.from(resolvedStateValue, context);

    return !!this.mapping[this.options.stateSerializer(state)];
  }
}

export function getValueAdjacencyMap<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  node: StateNode<TContext, any, TEvent>,
  options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
): ValueAdjacencyMap<TContext, TEvent> {
  const optionsWithDefaults = {
    events: {},
    stateSerializer: serializeState,
    eventSerializer: serializeEvent,
    ...options
  } as ValueAdjMapOptions<TContext, TEvent>;
  const { filter, stateSerializer, eventSerializer } = optionsWithDefaults;
  const events = {} as Record<TEvent['type'], Array<Event<TEvent>>>;
  node.events.forEach(event => {
    events[event] = [event];
  });
  Object.assign(events, optionsWithDefaults.events);

  const adjacency: ValueAdjacencyMap<TContext, TEvent> = {};

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
      const nextState = node.transition(state, event);

      if (
        (!filter || filter(nextState)) &&
        stateHash !== stateSerializer(nextState)
      ) {
        adjacency[stateHash][eventSerializer(event)] = nextState;

        findAdjacencies(nextState);
      }
    }
  }

  findAdjacencies(node.initialState);

  return adjacency;
}

export function getShortestValuePaths<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateNode<TContext, any, TEvent>,
  options: ValueAdjMapOptions<TContext, TEvent> = defaultValueAdjMapOptions
): PathMap<TContext, TEvent> {
  if (!machine.states) {
    return EMPTY_MAP;
  }
  const adjacency = getValueAdjacencyMap<TContext, TEvent>(machine, options);
  const pathMap: PathMap<TContext, TEvent> = {};
  const visited: Set<string> = new Set();

  function util(state: State<TContext>): PathMap<TContext, TEvent> {
    const stateKey = serializeState(state);
    visited.add(stateKey);
    const eventMap = adjacency[stateKey];

    for (const eventType of keys(eventMap)) {
      const { value, context } = eventMap[eventType];

      if (!value) {
        continue;
      }

      const nextState = State.from(value, context);
      const nextStateId = serializeState(nextState);

      if (
        !pathMap[nextStateId] ||
        pathMap[nextStateId].length > pathMap[stateKey].length + 1
      ) {
        pathMap[nextStateId] = [
          ...(pathMap[stateKey] || []),
          {
            state: { value, context: state.context },
            event: deserializeEventString(eventType) as TEvent
          }
        ];
      }
    }

    for (const event of keys(eventMap)) {
      const { value, context } = eventMap[event];

      if (!value) {
        continue;
      }

      const nextState = State.from(value, context);
      const nextStateId = serializeState(State.from(value, context));

      if (visited.has(nextStateId)) {
        continue;
      }

      util(nextState);
    }

    return pathMap;
  }

  util(machine.initialState);

  return pathMap;
}

export function getShortestPathsAsArray<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateNode<TContext, any, TEvent>
): Array<PathItem<TContext, TEvent>> {
  const result = getShortestValuePaths<TContext, TEvent>(
    machine,
    defaultValueAdjMapOptions
  );
  return keys(result).map(key => ({
    state: JSON.parse(key),
    path: result[key]
  }));
}

export function getSimplePaths<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateNode<TContext>,
  options?: Partial<ValueAdjMapOptions<TContext, TEvent>>
): PathsMap<TContext, TEvent> {
  if (!machine.states) {
    return EMPTY_MAP;
  }

  const adjacency = getValueAdjacencyMap(machine, options);
  const visited = new Set();
  const path: Array<Segment<TContext, TEvent>> = [];
  const paths: PathsMap<TContext, TEvent> = {};

  function util(fromStateSerial: string, toStateSerial: string) {
    visited.add(fromStateSerial);

    if (fromStateSerial === toStateSerial) {
      if (!paths[toStateSerial]) {
        paths[toStateSerial] = {
          state: deserializeStateString(toStateSerial),
          paths: []
        };
      }
      paths[toStateSerial].paths.push([...path]);
    } else {
      for (const subEvent of keys(adjacency[fromStateSerial])) {
        const nextState = adjacency[fromStateSerial][subEvent];

        if (!nextState) {
          continue;
        }

        const nextStateSerial = serializeState(nextState);

        if (!visited.has(nextStateSerial)) {
          path.push({
            state: deserializeStateString(fromStateSerial),
            event: deserializeEventString(subEvent)
          });
          util(nextStateSerial, toStateSerial);
        }
      }
    }

    path.pop();
    visited.delete(fromStateSerial);
  }

  const initialStateSerial = serializeState(machine.initialState);

  keys(adjacency).forEach(nextStateSerial => {
    util(initialStateSerial, nextStateSerial);
  });

  return paths;
}

export function getSimplePathsAsArray<
  TContext = DefaultContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateNode<TContext>,
  options?: ValueAdjMapOptions<TContext, TEvent>
): Array<PathsItem<TContext, TEvent>> {
  const result = getSimplePaths(machine, options);
  return keys(result).map(key => result[key]);
}
