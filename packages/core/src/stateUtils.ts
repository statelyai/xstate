import { EventObject, StateNode, StateValue } from '.';
import {
  keys,
  flatten,
  toStatePath,
  toStatePaths,
  toArray,
  warn,
  isArray,
  isFunction,
  isString,
  toGuard,
  toTransitionConfigArray,
  normalizeTarget,
  toStateValue,
  mapContext,
  partition,
  updateContext,
  mapValues
} from './utils';
import {
  TransitionConfig,
  TransitionDefinition,
  DelayedTransitionDefinition,
  NullEvent,
  SingleOrArray,
  Typestate,
  DelayExpr,
  Guard,
  SCXML,
  GuardMeta,
  GuardPredicate,
  StateTransition,
  ActionObject,
  DoneEventObject,
  StateValueMap,
  AssignAction,
  RaiseAction,
  SendAction,
  LogAction,
  PureAction,
  RaiseActionObject,
  SendActionObject,
  SpecialTargets,
  ActivityActionObject,
  HistoryValue
} from './types';
import { State } from './State';
import {
  send,
  cancel,
  after,
  done,
  doneInvoke,
  error,
  toActionObjects,
  start,
  raise,
  stop,
  initEvent,
  actionTypes,
  resolveRaise,
  resolveSend,
  resolveLog,
  toActionObject,
  toActivityDefinition
} from './actions';
import { IS_PRODUCTION } from './environment';
import {
  DEFAULT_GUARD_TYPE,
  STATE_IDENTIFIER,
  NULL_EVENT,
  WILDCARD
} from './constants';
import { createInvocableActor } from './Actor';
import { MachineNode } from './MachineNode';

type Configuration<TC, TE extends EventObject> = Iterable<
  StateNode<TC, any, TE>
>;

type AdjList<TC, TE extends EventObject> = Map<
  StateNode<TC, any, TE>,
  Array<StateNode<TC, any, TE>>
>;

export const isLeafNode = (stateNode: StateNode<any, any, any>) =>
  stateNode.type === 'atomic' || stateNode.type === 'final';

export function getChildren<TC, TE extends EventObject>(
  stateNode: StateNode<TC, any, TE>
): Array<StateNode<TC, any, TE>> {
  return keys(stateNode.states).map(key => stateNode.states[key]);
}

export function getProperAncestors<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  toStateNode: StateNode<TContext, any, TEvent> | null
): Array<typeof stateNode> {
  const ancestors = new Set<typeof stateNode>();

  // add all ancestors
  let m = stateNode.parent;
  while (m && m !== toStateNode) {
    ancestors.add(m);
    m = m.parent;
  }

  return [...ancestors];
}

export function getAllStateNodes<TC, TE extends EventObject>(
  stateNode: StateNode<TC, any, TE>
): Array<StateNode<TC, any, TE>> {
  const stateNodes = [stateNode];

  if (isLeafNode(stateNode)) {
    return stateNodes;
  }

  return stateNodes.concat(
    flatten(getChildren(stateNode).map(getAllStateNodes))
  );
}

export function getConfiguration<TC, TE extends EventObject>(
  prevStateNodes: Iterable<StateNode<TC, any, TE>>,
  stateNodes: Iterable<StateNode<TC, any, TE>>
): Iterable<StateNode<TC, any, TE>> {
  const prevConfiguration = new Set(prevStateNodes);
  const prevAdjList = getAdjList(prevConfiguration);

  const configuration = new Set(stateNodes);

  // add all ancestors
  for (const stateNode of configuration) {
    let m = stateNode.parent;

    while (m && !configuration.has(m)) {
      configuration.add(m);
      m = m.parent;
    }
  }

  const adjList = getAdjList(configuration);

  // add descendants
  for (const s of configuration) {
    // if previously active, add existing child nodes
    if (s.type === 'compound' && (!adjList.get(s) || !adjList.get(s)!.length)) {
      if (prevAdjList.get(s)) {
        prevAdjList.get(s)!.forEach(sn => configuration.add(sn));
      } else {
        getInitialStateNodes(s).forEach(sn => configuration.add(sn));
      }
    } else {
      if (s.type === 'parallel') {
        for (const child of getChildren(s)) {
          if (child.type === 'history') {
            continue;
          }

          if (!configuration.has(child)) {
            configuration.add(child);

            if (prevAdjList.get(child)) {
              prevAdjList.get(child)!.forEach(sn => configuration.add(sn));
            } else {
              getInitialStateNodes(child).forEach(sn => configuration.add(sn));
            }
          }
        }
      }
    }
  }

  // add all ancestors
  for (const s of configuration) {
    let m = s.parent;

    while (m && !configuration.has(m)) {
      configuration.add(m);
      m = m.parent;
    }
  }

  return configuration;
}

function getValueFromAdj<TC, TE extends EventObject>(
  baseNode: StateNode<TC, any, TE>,
  adjList: AdjList<TC, TE>
): StateValue {
  const childStateNodes = adjList.get(baseNode);

  if (!childStateNodes) {
    return {}; // todo: fix?
  }

  if (baseNode.type === 'compound') {
    const childStateNode = childStateNodes[0];
    if (childStateNode) {
      if (isLeafNode(childStateNode)) {
        return childStateNode.key;
      }
    } else {
      return {};
    }
  }

  const stateValue = {};
  childStateNodes.forEach(csn => {
    stateValue[csn.key] = getValueFromAdj(csn, adjList);
  });

  return stateValue;
}

export function getAdjList<TC, TE extends EventObject>(
  configuration: Configuration<TC, TE>
): AdjList<TC, TE> {
  const adjList: AdjList<TC, TE> = new Map();

  for (const s of configuration) {
    if (!adjList.has(s)) {
      adjList.set(s, []);
    }

    if (s.parent) {
      if (!adjList.has(s.parent)) {
        adjList.set(s.parent, []);
      }

      adjList.get(s.parent)!.push(s);
    }
  }

  return adjList;
}

export function getValue<TC, TE extends EventObject>(
  rootNode: StateNode<TC, any, TE>,
  configuration: Configuration<TC, TE>
): StateValue {
  const config = getConfiguration([rootNode], configuration);

  return getValueFromAdj(rootNode, getAdjList(config));
}

export function has<T>(iterable: Iterable<T>, item: T): boolean {
  if (Array.isArray(iterable)) {
    return iterable.some(member => member === item);
  }

  if (iterable instanceof Set) {
    return iterable.has(item);
  }

  return false; // TODO: fix
}

export function nextEvents<TC, TE extends EventObject>(
  configuration: Array<StateNode<TC, any, TE>>
): Array<TE['type']> {
  return flatten([...new Set(configuration.map(sn => sn.ownEvents))]);
}

export function isInFinalState<TC, TE extends EventObject>(
  configuration: Array<StateNode<TC, any, TE>>,
  stateNode: StateNode<TC, any, TE>
): boolean {
  if (stateNode.type === 'compound') {
    return getChildren(stateNode).some(
      s => s.type === 'final' && has(configuration, s)
    );
  }
  if (stateNode.type === 'parallel') {
    return getChildren(stateNode).every(sn =>
      isInFinalState(configuration, sn)
    );
  }

  return false;
}

export const isStateId = (str: string) => str[0] === STATE_IDENTIFIER;

export function getCandidates<TEvent extends EventObject>(
  stateNode: StateNode<any, any, TEvent>,
  eventName: TEvent['type'] | NullEvent['type'] | '*'
) {
  const transient = eventName === NULL_EVENT;
  const candidates = stateNode.transitions.filter(transition => {
    const sameEventType = transition.eventType === eventName;
    // null events should only match against eventless transitions
    return transient
      ? sameEventType
      : sameEventType || transition.eventType === WILDCARD;
  }) as any;

  return candidates;
}
/**
 * All delayed transitions from the config.
 */
export function getDelayedTransitions<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>
): Array<DelayedTransitionDefinition<TContext, TEvent>> {
  const afterConfig = stateNode.config.after;
  if (!afterConfig) {
    return [];
  }
  const mutateEntryExit = (
    delay: string | number | DelayExpr<TContext, TEvent>,
    i: number
  ) => {
    const delayRef = isFunction(delay) ? `${stateNode.id}:delay[${i}]` : delay;
    const eventType = after(delayRef, stateNode.id);
    stateNode.entry.push(send(eventType, { delay }));
    stateNode.exit.push(cancel(eventType));
    return eventType;
  };
  const delayedTransitions = isArray(afterConfig)
    ? afterConfig.map((transition, i) => {
        const eventType = mutateEntryExit(transition.delay, i);
        return { ...transition, event: eventType };
      })
    : flatten(
        keys(afterConfig).map((delay, i) => {
          const configTransition = afterConfig[delay];
          const resolvedTransition = isString(configTransition)
            ? { target: configTransition }
            : configTransition;
          const resolvedDelay = !isNaN(+delay) ? +delay : delay;
          const eventType = mutateEntryExit(resolvedDelay, i);
          return toArray(resolvedTransition).map(transition => ({
            ...transition,
            event: eventType,
            delay: resolvedDelay
          }));
        })
      );
  return delayedTransitions.map(delayedTransition => {
    const { delay } = delayedTransition;
    return {
      ...formatTransition(stateNode, delayedTransition),
      delay
    };
  });
}
function formatTransition<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  transitionConfig: TransitionConfig<TContext, TEvent> & {
    event: TEvent['type'] | NullEvent['type'] | '*';
  }
): TransitionDefinition<TContext, TEvent> {
  const normalizedTarget = normalizeTarget(transitionConfig.target);
  const internal =
    'internal' in transitionConfig
      ? transitionConfig.internal
      : normalizedTarget
      ? normalizedTarget.some(
          _target =>
            isString(_target) && _target[0] === stateNode.machine.delimiter
        )
      : true;
  const { guards } = stateNode.machine.options;
  const target = resolveTarget(stateNode, normalizedTarget);
  return {
    ...transitionConfig,
    actions: toActionObjects(toArray(transitionConfig.actions)),
    cond: toGuard(transitionConfig.cond, guards),
    target,
    source: stateNode,
    internal,
    eventType: transitionConfig.event
  };
}
export function formatTransitions<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>
): Array<TransitionDefinition<TContext, TEvent>> {
  let onConfig: Array<
    TransitionConfig<TContext, EventObject> & {
      event: string;
    }
  >;
  if (!stateNode.config.on) {
    onConfig = [];
  } else if (Array.isArray(stateNode.config.on)) {
    onConfig = stateNode.config.on;
  } else {
    const {
      [WILDCARD]: wildcardConfigs = [],
      ...strictOnConfigs
    } = stateNode.config.on;
    onConfig = flatten(
      keys(strictOnConfigs)
        .map(key => {
          const arrayified = toTransitionConfigArray<TContext, EventObject>(
            key,
            strictOnConfigs![key as string]
          );
          // TODO: add dev-mode validation for unreachable transitions
          return arrayified;
        })
        .concat(
          toTransitionConfigArray(WILDCARD, wildcardConfigs as SingleOrArray<
            TransitionConfig<TContext, EventObject> & {
              event: '*';
            }
          >)
        )
    );
  }
  const doneConfig = stateNode.config.onDone
    ? toTransitionConfigArray(
        String(done(stateNode.id)),
        stateNode.config.onDone
      )
    : [];
  const invokeConfig = flatten(
    stateNode.invoke.map(invokeDef => {
      const settleTransitions: any[] = [];
      if (invokeDef.onDone) {
        settleTransitions.push(
          ...toTransitionConfigArray(
            String(doneInvoke(invokeDef.id)),
            invokeDef.onDone
          )
        );
      }
      if (invokeDef.onError) {
        settleTransitions.push(
          ...toTransitionConfigArray(
            String(error(invokeDef.id)),
            invokeDef.onError
          )
        );
      }
      return settleTransitions;
    })
  );
  const delayedTransitions = stateNode.after;
  const formattedTransitions = flatten(
    [...doneConfig, ...invokeConfig, ...onConfig].map(
      (
        transitionConfig: TransitionConfig<TContext, TEvent> & {
          event: TEvent['type'] | NullEvent['type'] | '*';
        }
      ) =>
        toArray(transitionConfig).map(transition =>
          formatTransition(stateNode, transition)
        )
    )
  );
  for (const delayedTransition of delayedTransitions) {
    formattedTransitions.push(delayedTransition as any);
  }
  return formattedTransitions;
}
function resolveTarget<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  _target: Array<string | StateNode<TContext, any, TEvent>> | undefined
): Array<StateNode<TContext, any, TEvent>> | undefined {
  if (_target === undefined) {
    // an undefined target signals that the state node should not transition from that state when receiving that event
    return undefined;
  }
  return _target.map(target => {
    if (!isString(target)) {
      return target;
    }
    const isInternalTarget = target[0] === stateNode.machine.delimiter;
    // If internal target is defined on machine,
    // do not include machine key on target
    if (isInternalTarget && !stateNode.parent) {
      return getStateNodeByPath(stateNode, target.slice(1));
    }
    const resolvedTarget = isInternalTarget ? stateNode.key + target : target;
    if (stateNode.parent) {
      try {
        const targetStateNode = getStateNodeByPath(
          stateNode.parent,
          resolvedTarget
        );
        return targetStateNode;
      } catch (err) {
        throw new Error(
          `Invalid transition definition for state node '${stateNode.id}':\n${err.message}`
        );
      }
    } else {
      return getStateNodeByPath(stateNode, resolvedTarget);
    }
  });
}
/**
 * Resolves to the historical value(s) of the parent state node,
 * represented by state nodes.
 */
function resolveHistory<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent> & { type: 'history' },
  state?: State<TContext, TEvent>
): Array<StateNode<TContext, any, TEvent>> {
  const parent = stateNode.parent!;
  if (!state || !state.historyValue[stateNode.id]) {
    const historyTarget = stateNode.target;
    return historyTarget
      ? flatten(
          toStatePaths(historyTarget).map(relativeChildPath =>
            getFromRelativePath(parent, relativeChildPath)
          )
        )
      : getInitialStateNodes(parent);
  }

  return state.historyValue[stateNode.id];
}

function isHistoryNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>
): stateNode is StateNode<TContext, any, TEvent> & { type: 'history' } {
  return stateNode.type === 'history';
}

/**
 * Retrieves state nodes from a relative path to the state node.
 *
 * @param relativePath The relative path from the state node
 */
function getFromRelativePath<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  relativePath: string[]
): Array<StateNode<TContext, any, TEvent>> {
  if (!relativePath.length) {
    return [stateNode];
  }
  const [stateKey, ...childStatePath] = relativePath;
  if (!stateNode.states) {
    throw new Error(
      `Cannot retrieve subPath '${stateKey}' from node with no states`
    );
  }
  const childStateNode = getStateNode(stateNode, stateKey);
  if (isHistoryNode(childStateNode)) {
    return resolveHistory(childStateNode);
  }
  if (!stateNode.states[stateKey]) {
    throw new Error(
      `Child state '${stateKey}' does not exist on '${stateNode.id}'`
    );
  }
  return getFromRelativePath(stateNode.states[stateKey], childStatePath);
}
/**
 * Returns the leaf nodes from a state path relative to the state node.
 *
 * @param relativeStateNode The relative state node to retrieve the state nodes
 * @param state The previous state to retrieve history
 * @param resolveInitialStateNodes Whether state nodes should resolve to initial child state nodes
 */
export function getRelativeStateNodes<TContext, TEvent extends EventObject>(
  relativeStateNode: StateNode<TContext, any, TEvent>,
  state?: State<TContext, TEvent>,
  resolveInitialStateNodes: boolean = true
): Array<StateNode<TContext, any, TEvent>> {
  return resolveInitialStateNodes
    ? isHistoryNode(relativeStateNode)
      ? resolveHistory(relativeStateNode, state)
      : getInitialStateNodes(relativeStateNode)
    : [relativeStateNode];
}

export function getInitialStateNodes<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>
): Array<StateNode<TContext, any, TEvent>> {
  if (isLeafNode(stateNode)) {
    return [stateNode];
  }
  // Case when state node is compound but no initial state is defined
  if (stateNode.type === 'compound' && !stateNode.initial) {
    if (!IS_PRODUCTION) {
      warn(
        false,
        `Compound state node '${stateNode.id}' has no initial state.`
      );
    }
    return [stateNode];
  }
  const initialStateNodePaths = toStatePaths(stateNode.initialStateValue!);
  return flatten(
    initialStateNodePaths.map(initialPath =>
      getFromRelativePath(stateNode, initialPath)
    )
  );
}
export function getInitialState<
  TContext,
  TStateSchema,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  machine: MachineNode<TContext, TStateSchema, TEvent>,
  stateValue: StateValue,
  context?: TContext
): State<TContext, TEvent, TStateSchema, TTypestate> {
  const configuration = getStateNodes(machine, stateValue);
  return resolveTransition(
    machine,
    {
      configuration,
      entrySet: configuration,
      exitSet: [], // TODO: not needed
      transitions: [],
      source: undefined,
      actions: []
    },
    undefined,
    undefined,
    context
  );
}
/**
 * Returns the child state node from its relative `stateKey`, or throws.
 */
export function getStateNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateKey: string
): StateNode<TContext, any, TEvent> {
  if (isStateId(stateKey)) {
    return getStateNodeById(stateNode.machine, stateKey);
  }
  if (!stateNode.states) {
    throw new Error(
      `Unable to retrieve child state '${stateKey}' from '${stateNode.id}'; no child states exist.`
    );
  }
  const result = stateNode.states[stateKey];
  if (!result) {
    throw new Error(
      `Child state '${stateKey}' does not exist on '${stateNode.id}'`
    );
  }
  return result;
}
/**
 * Returns the state node with the given `stateId`, or throws.
 *
 * @param stateId The state ID. The prefix "#" is removed.
 */
export function getStateNodeById<TContext, TEvent extends EventObject>(
  fromStateNode: StateNode<TContext, any, TEvent>,
  stateId: string
): StateNode<TContext, any, TEvent> {
  const resolvedStateId = isStateId(stateId)
    ? stateId.slice(STATE_IDENTIFIER.length)
    : stateId;
  if (resolvedStateId === fromStateNode.id) {
    return fromStateNode;
  }
  const stateNode = fromStateNode.machine.idMap[resolvedStateId];
  if (!stateNode) {
    throw new Error(
      `Child state node '#${resolvedStateId}' does not exist on machine '${fromStateNode.id}'`
    );
  }
  return stateNode;
}
/**
 * Returns the relative state node from the given `statePath`, or throws.
 *
 * @param statePath The string or string array relative path to the state node.
 */
function getStateNodeByPath<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  statePath: string | string[]
): StateNode<TContext, any, TEvent> {
  if (typeof statePath === 'string' && isStateId(statePath)) {
    try {
      return getStateNodeById(stateNode, statePath.slice(1));
    } catch (e) {
      // try individual paths
      // throw e;
    }
  }
  const arrayStatePath = toStatePath(
    statePath,
    stateNode.machine.delimiter
  ).slice();
  let currentStateNode: StateNode<TContext, any, TEvent> = stateNode;
  while (arrayStatePath.length) {
    const key = arrayStatePath.shift()!;
    if (!key.length) {
      break;
    }
    currentStateNode = getStateNode(currentStateNode, key);
  }
  return currentStateNode;
}

/**
 * Returns the state nodes represented by the current state value.
 *
 * @param state The state value or State instance
 */
export function getStateNodes<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  state: StateValue | State<TContext, TEvent>
): Array<StateNode<TContext, any, TEvent>> {
  if (!state) {
    return [];
  }
  const stateValue =
    state instanceof State
      ? state.value
      : toStateValue(state, stateNode.machine.delimiter);

  if (isString(stateValue)) {
    const initialStateValue = getStateNode(stateNode, stateValue).initial;

    return initialStateValue !== undefined
      ? getStateNodes(stateNode, {
          [stateValue]: initialStateValue
        } as StateValue)
      : [stateNode.states[stateValue]];
  }

  const subStateKeys = keys(stateValue);
  const subStateNodes: Array<
    StateNode<TContext, any, TEvent>
  > = subStateKeys.map(subStateKey => getStateNode(stateNode, subStateKey));

  return subStateNodes.concat(
    subStateKeys.reduce(
      (allSubStateNodes, subStateKey) => {
        const subStateNode = getStateNodes(
          getStateNode(stateNode, subStateKey),
          stateValue[subStateKey]
        );

        return allSubStateNodes.concat(subStateNode);
      },
      [] as Array<StateNode<TContext, any, TEvent>>
    )
  );
}

export function nodesFromChild<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  childStateNode: StateNode<TContext, any, TEvent>
): Array<StateNode<TContext, any, TEvent>> {
  if (escapes(childStateNode, stateNode)) {
    return [];
  }

  const nodes: Array<StateNode<TContext, any, TEvent>> = [];
  let marker: StateNode<TContext, any, TEvent> | undefined = childStateNode;

  while (marker && marker !== stateNode) {
    nodes.push(marker);
    marker = marker.parent;
  }
  nodes.push(stateNode); // inclusive

  return nodes;
}

/**
 * Whether the given state node "escapes" the state node. If the `stateNode` is equal to or the parent of
 * the state node, it does not escape.
 */
export function escapes<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  escapeeNode: StateNode<TContext, any, TEvent>
): boolean {
  if (stateNode === escapeeNode) {
    return false;
  }

  let parent = stateNode.parent;

  while (parent) {
    if (parent === escapeeNode) {
      return false;
    }
    parent = parent.parent;
  }

  return true;
}

export function evaluateGuard<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  guard: Guard<TContext, TEvent>,
  context: TContext,
  _event: SCXML.Event<TEvent>,
  state: State<TContext, TEvent>
): boolean {
  const { guards } = stateNode.machine.options;
  const guardMeta: GuardMeta<TContext, TEvent> = {
    state,
    cond: guard,
    _event
  };

  if (guard.type === DEFAULT_GUARD_TYPE) {
    return (guard as GuardPredicate<TContext, TEvent>).predicate(
      context,
      _event.data,
      guardMeta
    );
  }

  const condFn = guards[guard.type];

  if (!condFn) {
    throw new Error(
      `Guard '${guard.type}' is not implemented on machine '${stateNode.machine.id}'.`
    );
  }

  return condFn(context, _event.data, guardMeta);
}

function getActivities(stateNode: StateNode<any, any, any>) {
  return toArray(stateNode.invoke).map(toActivityDefinition);
}

export function getActions<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  transition: StateTransition<TContext, TEvent>,
  currentContext: TContext,
  _event: SCXML.Event<TEvent>
): Array<ActionObject<TContext, TEvent>> {
  const entryStates = new Set(transition.entrySet);

  const doneEvents = flatten(
    [...entryStates].map(sn => {
      const events: DoneEventObject[] = [];

      if (sn.type !== 'final') {
        return events;
      }

      const parent = sn.parent!;

      events.push(
        // done(sn.id, sn.data), // TODO: deprecate - final states should not emit done events for their own state.
        done(
          parent.id,
          sn.data ? mapContext(sn.data, currentContext, _event) : undefined
        )
      );

      if (parent.parent) {
        const grandparent = parent.parent;

        if (grandparent.type === 'parallel') {
          if (
            getChildren(grandparent).every(parentNode =>
              isInFinalState(transition.configuration, parentNode)
            )
          ) {
            events.push(done(grandparent.id, grandparent.data));
          }
        }
      }

      return events;
    })
  );

  const statesToExit = new Set(transition.exitSet);

  const [entryActions, exitActions] = [
    flatten(
      Array.from(entryStates).map(entryNode => {
        return [
          ...getActivities(entryNode).map(activity => start(activity)),
          ...entryNode.entry
        ];
      })
    ).concat(doneEvents.map(raise) as Array<ActionObject<TContext, TEvent>>),
    flatten(
      Array.from(statesToExit).map(exitNode => [
        ...exitNode.exit,
        ...getActivities(exitNode).map(activity => stop(activity))
      ])
    )
  ];

  const actions = toActionObjects(
    exitActions.concat(transition.actions).concat(entryActions),
    stateNode.machine.options.actions
  ) as Array<ActionObject<TContext, TEvent>>;

  return actions;
}

export function transitionLeafNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: string,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): StateTransition<TContext, TEvent> | undefined {
  const childStateNode = getStateNode(stateNode, stateValue);
  const next = childStateNode.next(state, _event);

  if (!next || !next.transitions.length) {
    return stateNode.next(state, _event);
  }

  return next;
}

export function transitionCompoundNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: StateValueMap,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): StateTransition<TContext, TEvent> | undefined {
  const subStateKeys = keys(stateValue);

  const childStateNode = getStateNode(stateNode, subStateKeys[0]);
  const next = transitionNode(
    childStateNode,
    stateValue[subStateKeys[0]],
    state,
    _event
  );

  if (!next || !next.transitions.length) {
    return stateNode.next(state, _event);
  }

  return next;
}
export function transitionParallelNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: StateValueMap,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): StateTransition<TContext, TEvent> | undefined {
  const transitionMap: Record<string, StateTransition<TContext, TEvent>> = {};

  for (const subStateKey of keys(stateValue)) {
    const subStateValue = stateValue[subStateKey];

    if (!subStateValue) {
      continue;
    }

    const subStateNode = getStateNode(stateNode, subStateKey);
    const nextStateNode = transitionNode(
      subStateNode,
      subStateValue,
      state,
      _event
    );
    if (nextStateNode) {
      transitionMap[subStateKey] = nextStateNode;
    }
  }

  const stateTransitions = keys(transitionMap).map(key => transitionMap[key]);
  const enabledTransitions = flatten(
    stateTransitions.map(st => st.transitions)
  );

  const willTransition = stateTransitions.some(st => st.transitions.length > 0);

  if (!willTransition) {
    return stateNode.next(state, _event);
  }
  const entryNodes = flatten(stateTransitions.map(t => t.entrySet));

  const configuration = flatten(
    keys(transitionMap).map(key => transitionMap[key].configuration)
  );

  return {
    transitions: enabledTransitions,
    entrySet: entryNodes,
    exitSet: [], // TODO: not needed
    configuration,
    source: state,
    actions: flatten(
      keys(transitionMap).map(key => {
        return transitionMap[key].actions;
      })
    )
  };
}

export function transitionNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: StateValue,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): StateTransition<TContext, TEvent> | undefined {
  // leaf node
  if (isString(stateValue)) {
    return transitionLeafNode(stateNode, stateValue, state, _event);
  }

  // hierarchical node
  if (keys(stateValue).length === 1) {
    return transitionCompoundNode(stateNode, stateValue, state, _event);
  }

  // orthogonal node
  return transitionParallelNode(stateNode, stateValue, state, _event);
}

export function resolveRaisedTransition<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  machine: MachineNode<TContext, any, TEvent>,
  state: State<TContext, TEvent, any, TTypestate>,
  _event: SCXML.Event<TEvent> | NullEvent,
  originalEvent: SCXML.Event<TEvent>
): State<TContext, TEvent, any, TTypestate> {
  const currentActions = state.actions;

  state = machine.transition(state, _event as SCXML.Event<TEvent>);
  // Save original event to state
  state._event = originalEvent;
  state.event = originalEvent.data;
  state.actions.unshift(...currentActions);
  return state;
}

function getHistoryNodes<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>
): Array<StateNode<TContext, any, TEvent>> {
  return getChildren(stateNode).filter(sn => {
    return sn.type === 'history';
  });
}

function isDescendant<TC, TE extends EventObject>(
  childStateNode: StateNode<TC, any, TE>,
  parentStateNode: StateNode<TC, any, TE>
): boolean {
  let marker = childStateNode;
  while (marker.parent && marker.parent !== parentStateNode) {
    marker = marker.parent;
  }

  return marker.parent === parentStateNode;
}

function getPathFromRootToNode<TC, TE extends EventObject>(
  stateNode: StateNode<TC, any, TE>
): Array<StateNode<TC, any, TE>> {
  const path: Array<StateNode<TC, any, TE>> = [];
  let marker = stateNode.parent;

  while (marker) {
    path.unshift(marker);
    marker = marker.parent;
  }

  return path;
}

function findLCCA<TContext, TEvent extends EventObject>(
  stateNodes: Array<StateNode<TContext, any, TEvent>>
): StateNode<TContext, any, TEvent> {
  const [head] = stateNodes;

  let current = getPathFromRootToNode(head);
  let candidates: Array<StateNode<TContext, any, TEvent>> = [];

  stateNodes.forEach(stateNode => {
    const path = getPathFromRootToNode(stateNode);

    candidates = current.filter(sn => path.includes(sn));
    current = candidates;
    candidates = [];
  });

  return current[current.length - 1];
}

function getEffectiveTargetStates<TC, TE extends EventObject>(
  transition: TransitionDefinition<TC, TE>,
  state: State<TC, TE>
): Array<StateNode<TC, any, TE>> {
  const targets = new Set<StateNode<TC, any, TE>>();

  for (const s of transition.target || []) {
    if (isHistoryNode(s)) {
      resolveHistory(s, state).forEach(t => targets.add(t));
    } else {
      targets.add(s);
    }
  }

  return [...targets];
}

function getTransitionDomain<TContext, TEvent extends EventObject>(
  transition: TransitionDefinition<TContext, TEvent>,
  state: State<TContext, TEvent>
): StateNode<TContext, any, TEvent> | null {
  const targetStates = getEffectiveTargetStates(transition, state);

  if (!targetStates) {
    return null;
  }

  if (
    transition.internal &&
    transition.source.type === 'compound' &&
    targetStates.every(targetStateNode =>
      isDescendant(targetStateNode, transition.source)
    )
  ) {
    return transition.source;
  }

  const lcca = findLCCA(targetStates.concat(transition.source));

  return lcca;
}

function exitStates<TContext, TEvent extends EventObject>(
  transitions: Array<TransitionDefinition<TContext, TEvent>>,
  configuration: Array<StateNode<TContext, any, TEvent>>,
  state: State<TContext, TEvent>
) {
  const statesToExit = computeExitSet(transitions, configuration, state);
  const actions: Array<ActionObject<TContext, TEvent>> = [];

  statesToExit.forEach(stateNode => {
    actions.push(...stateNode.invoke.map(def => stop(def)));
  });

  statesToExit.sort((a, b) => b.order - a.order);

  const historyValue = resolveHistoryValue(state, statesToExit);

  const newConfiguration = new Set(configuration);
  for (const s of statesToExit) {
    actions.push(...flatten(s.exit));
    newConfiguration.delete(s);
  }

  return {
    exitSet: statesToExit,
    historyValue,
    actions,
    configuration: [...newConfiguration]
  };
}

export function enterStates<TContext, TEvent extends EventObject>(
  transitions: Array<TransitionDefinition<TContext, TEvent>>,
  configuration: Set<StateNode<TContext, any, TEvent>>,
  state: State<TContext, TEvent>
) {
  const defaultHistoryContent = {};
  const statesToInvoke: typeof configuration = new Set();
  const internalQueue: EventObject[] = [];

  const actions: Array<ActionObject<TContext, TEvent>> = [];
  const statesToEnter = new Set<StateNode<TContext, any, TEvent>>();

  const { statesForDefaultEntry } = computeEntrySet(
    transitions,
    state,
    statesToEnter
  );

  for (const s of [...statesToEnter].sort((a, b) => b.order - a.order)) {
    configuration.add(s);
    statesToInvoke.add(s);
    actions.push(...s.entry);
    // if (statesForDefaultEntry.has(s)) {
    //   // TODO: execute initial transition
    // }
    // if (defaultHistoryContent[s.id]) {
    //   actions.push(...defaultHistoryContent[s.id])
    // }
    if (s.type === 'final') {
      const parent = s.parent!;
      internalQueue.push(done(parent!.id, s.data));

      if (parent.parent) {
        const grandparent = parent.parent;

        if (grandparent.type === 'parallel') {
          if (
            getChildren(grandparent).every(parentNode =>
              isInFinalState([...configuration], parentNode)
            )
          ) {
            internalQueue.push(done(grandparent.id, grandparent.data));
          }
        }
      }
    }
  }

  return {
    defaultHistoryContent,
    configuration: [...configuration],
    statesToInvoke,
    internalQueue,
    statesForDefaultEntry,
    actions
  };
}

function computeExitSet<TContext, TEvent extends EventObject>(
  transitions: Array<TransitionDefinition<TContext, TEvent>>,
  configuration: Array<StateNode<TContext, any, TEvent>>,
  state: State<TContext, TEvent>
): Array<StateNode<TContext, any, TEvent>> {
  const statesToExit = new Set<StateNode<TContext, any, TEvent>>();

  for (const t of transitions) {
    if (t.target && t.target.length) {
      const domain = getTransitionDomain(t, state);

      for (const s of configuration) {
        if (isDescendant(s, domain!)) {
          statesToExit.add(s);
        }
      }
    }
  }

  return [...statesToExit];
}

function computeEntrySet<TContext, TEvent extends EventObject>(
  transitions: Array<TransitionDefinition<TContext, TEvent>>,
  state: State<TContext, TEvent>,
  statesToEnter: Set<StateNode<TContext, any, TEvent>>
) {
  const statesForDefaultEntry = new Set<StateNode<TContext, any, TEvent>>();

  for (const t of transitions) {
    for (const s of t.target || []) {
      const result = addDescendentStatesToEnter(s, state, statesToEnter);
      result.statesToEnter.forEach(se => statesToEnter.add(se));
      result.statesForDefaultEntry.forEach(se => statesForDefaultEntry.add(se));
    }
    const ancestor = getTransitionDomain(t, state);
    for (const s of getEffectiveTargetStates(t, state)) {
      const result = addAncestorStatesToEnter(
        s,
        ancestor,
        state,
        statesToEnter
      );
      result.statesToEnter.forEach(se => statesToEnter.add(se));
      result.statesForDefaultEntry.forEach(se => statesForDefaultEntry.add(se));
    }
  }

  return { statesToEnter, statesForDefaultEntry };
}

function addDescendentStatesToEnter<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  state: State<TContext, TEvent>,
  statesToEnter: Set<typeof stateNode>
) {
  // const statesToEnter = new Set<typeof stateNode>();
  const statesForDefaultEntry = new Set<typeof stateNode>();

  if (isHistoryNode(stateNode)) {
    if (state.historyValue[stateNode.id]) {
      for (const s of state.historyValue[stateNode.id]) {
        const result = addDescendentStatesToEnter(s, state, statesToEnter);

        result.statesToEnter.forEach(stateToEnter =>
          statesToEnter.add(stateToEnter)
        );
        result.statesForDefaultEntry.forEach(stateForDefaultEntry =>
          statesForDefaultEntry.add(stateForDefaultEntry)
        );
      }
      for (const s of state.historyValue[stateNode.id]) {
        const result = addAncestorStatesToEnter(
          s,
          stateNode,
          state,
          statesToEnter
        );
        result.statesToEnter.forEach(stateToEnter =>
          statesToEnter.add(stateToEnter)
        );
        result.statesForDefaultEntry.forEach(stateForDefaultEntry =>
          statesForDefaultEntry.add(stateForDefaultEntry)
        );
      }
    } else {
      // defaultHistoryContent[stateNode.parent.id] = state.transition.content
      const historyTarget = stateNode.target;
      const targets = historyTarget
        ? flatten(
            toStatePaths(historyTarget).map(relativeChildPath =>
              getFromRelativePath(stateNode.parent!, relativeChildPath)
            )
          )
        : [];
      for (const s of targets) {
        const result = addDescendentStatesToEnter(s, state, statesToEnter);

        result.statesToEnter.forEach(stateToEnter =>
          statesToEnter.add(stateToEnter)
        );
        result.statesForDefaultEntry.forEach(stateForDefaultEntry =>
          statesForDefaultEntry.add(stateForDefaultEntry)
        );
      }
      for (const s of targets) {
        const result = addAncestorStatesToEnter(
          s,
          stateNode,
          state,
          statesToEnter
        );
        result.statesToEnter.forEach(stateToEnter =>
          statesToEnter.add(stateToEnter)
        );
        result.statesForDefaultEntry.forEach(stateForDefaultEntry =>
          statesForDefaultEntry.add(stateForDefaultEntry)
        );
      }
    }
  } else {
    statesToEnter.add(stateNode);
    if (stateNode.type === 'compound') {
      statesForDefaultEntry.add(stateNode);
      const initialStateNode = stateNode.states[stateNode.initial as string];
      addDescendentStatesToEnter(initialStateNode, state, statesToEnter);
      // for (const s of getInitialStateNodes(stateNode)) {
      //   const result = addDescendentStatesToEnter(s, state);

      //   result.statesToEnter.forEach(stateToEnter =>
      //     statesToEnter.add(stateToEnter)
      //   );
      //   result.statesForDefaultEntry.forEach(stateForDefaultEntry =>
      //     statesForDefaultEntry.add(stateForDefaultEntry)
      //   );
      // }
      addAncestorStatesToEnter(
        initialStateNode,
        stateNode,
        state,
        statesToEnter
      );
      // for (const s of getInitialStateNodes(stateNode)) {
      //   const result = addAncestorStatesToEnter(s, stateNode, state);
      //   result.statesToEnter.forEach(stateToEnter =>
      //     statesToEnter.add(stateToEnter)
      //   );
      //   result.statesForDefaultEntry.forEach(stateForDefaultEntry =>
      //     statesForDefaultEntry.add(stateForDefaultEntry)
      //   );
      // }
    } else {
      if (stateNode.type === 'parallel') {
        for (const child of getChildren(stateNode)) {
          if (![...statesToEnter].some(s => isDescendant(s, child))) {
            const result = addDescendentStatesToEnter(
              child,
              state,
              statesToEnter
            );

            result.statesToEnter.forEach(stateToEnter =>
              statesToEnter.add(stateToEnter)
            );
            result.statesForDefaultEntry.forEach(stateForDefaultEntry =>
              statesForDefaultEntry.add(stateForDefaultEntry)
            );
          }
        }
      }
    }
  }

  return {
    statesToEnter,
    statesForDefaultEntry
  };
}

function addAncestorStatesToEnter<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  toStateNode: StateNode<TContext, any, TEvent> | null,
  state: State<TContext, TEvent>,
  statesToEnter: Set<typeof stateNode>
) {
  // const statesToEnter = new Set<typeof stateNode>();
  const statesForDefaultEntry = new Set<typeof stateNode>();

  for (const anc of getProperAncestors(stateNode, toStateNode)) {
    statesToEnter.add(anc);
    if (anc.type === 'parallel') {
      for (const child of getChildren(anc).filter(sn => !isHistoryNode(sn))) {
        if (![...statesToEnter].some(s => isDescendant(s, child))) {
          const result = addDescendentStatesToEnter(
            child,
            state,
            statesToEnter
          );
          result.statesToEnter.forEach(stateToEnter =>
            statesToEnter.add(stateToEnter)
          );
          result.statesForDefaultEntry.forEach(stateForDefaultEntry =>
            statesForDefaultEntry.add(stateForDefaultEntry)
          );
        }
      }
    }
  }

  return { statesToEnter, statesForDefaultEntry };
}

export function xresolveTransition<TContext, TEvent extends EventObject>(
  stateTransition: StateTransition<TContext, TEvent>,
  currentState: State<TContext, TEvent> | undefined,
  _event: SCXML.Event<TEvent> = initEvent as SCXML.Event<TEvent>,
  machine: MachineNode<TContext, any, TEvent>,
  c: Array<StateNode<TContext, any, TEvent>>
) {
  const actions: Array<ActionObject<TContext, TEvent>> = [];
  const configuration: Array<StateNode<TContext, any, TEvent>> = currentState
    ? []
    : stateTransition.configuration; // TODO: handle this better

  const transitions = currentState
    ? stateTransition.transitions
    : [
        {
          target: stateTransition.configuration,
          source: machine,
          actions: [],
          eventType: 'init'
        }
      ];

  if (currentState) {
    const current = currentState;

    const {
      historyValue,
      configuration: configurationFromExit,
      actions: exitActions
    } = exitStates(transitions, c, current);

    actions.push(...exitActions);

    current.historyValue = historyValue;

    actions.push(...stateTransition.actions);

    configuration.push(...configurationFromExit);
  }

  const res = enterStates(
    transitions,
    new Set(configuration),
    currentState || State.from({})
  );

  // internal queue events
  actions.push(...res.internalQueue.map(raise));

  configuration.push(...res.configuration);

  actions.push(...flatten([...res.statesToInvoke].map(s => s.invoke)));

  actions.push(...res.actions);

  return actions;
}

export function resolveTransition<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  machine: MachineNode<TContext, any, TEvent>,
  stateTransition: StateTransition<TContext, TEvent>,
  currentState?: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent> = initEvent as SCXML.Event<TEvent>,
  context: TContext = machine.machine.context!
): State<TContext, TEvent, any, TTypestate> {
  const { configuration } = stateTransition;
  // Transition will "apply" if:
  // - the state node is the initial state (there is no current state)
  // - OR there are transitions
  const willTransition =
    !currentState || stateTransition.transitions.length > 0;
  const resolvedStateValue = willTransition
    ? getValue(machine.machine, configuration)
    : undefined;

  // Entry and exit set
  const prevConfig = getConfiguration(
    [],
    currentState ? getStateNodes(machine, currentState.value) : [machine]
  );
  const resolvedConfig = stateTransition.configuration.length
    ? getConfiguration(prevConfig, stateTransition.configuration)
    : prevConfig;

  for (const sn of resolvedConfig) {
    if (!has(prevConfig, sn)) {
      stateTransition.entrySet.push(sn);
    }
  }

  if (!stateTransition.source) {
    // Ensure that root StateNode (machine) is entered
    stateTransition.entrySet.push(machine);
  }
  stateTransition.entrySet.sort((a, b) => a.order - b.order);

  // const eee = enterStates(
  //   stateTransition.transitions,
  //   currentState || State.from({})
  // );

  const {
    exitSet: computedExitSet,
    historyValue
    // configuration: exitConfiguration
  } =
    currentState && currentState.configuration
      ? exitStates(
          stateTransition.transitions,
          currentState.configuration,
          currentState
        )
      : {
          exitSet: stateTransition.exitSet,
          historyValue: resolveHistoryValue<TContext, TEvent>(
            currentState,
            stateTransition.exitSet
          )
          // configuration: [...resolvedConfig]
        };

  // const allConfiguration = new Set([
  //   ...exitConfiguration,
  //   ...eee.configuration
  // ]);

  // if ([...resolvedConfig].length !== [...allConfiguration].length) {
  //   console.log('RES', [...resolvedConfig].map(s => s.id));
  //   console.log('EEE', [...allConfiguration].map(s => s.id));
  //   throw new Error('no');
  // }

  stateTransition.exitSet = computedExitSet;

  const currentContext = currentState ? currentState.context : context;
  const actions = getActions(machine, stateTransition, currentContext, _event);

  const xres = xresolveTransition(
    stateTransition,
    currentState,
    _event,
    machine,
    [...prevConfig]
  );
  if (actions.length !== xres.length) {
    console.log(_event.name);
    console.log('actions', actions.map(a => a));
    console.log('calcula', xres.map(a => a));
    throw new Error('no');
  }

  const [assignActions, otherActions] = partition(
    xres,
    (action): action is AssignAction<TContext, TEvent> =>
      action.type === actionTypes.assign
  );

  const updatedContext = assignActions.length
    ? updateContext(currentContext, _event, assignActions, currentState)
    : currentContext;

  const resolvedActions = flatten(
    otherActions.map(actionObject => {
      switch (actionObject.type) {
        case actionTypes.raise:
          return resolveRaise(actionObject as RaiseAction<TEvent>);
        case actionTypes.send:
          const sendAction = resolveSend(
            actionObject as SendAction<TContext, TEvent>,
            updatedContext,
            _event,
            machine.machine.options.delays
          ) as ActionObject<TContext, TEvent>; // TODO: fix ActionTypes.Init

          if (!IS_PRODUCTION) {
            // warn after resolving as we can create better contextual message here
            warn(
              !isString(actionObject.delay) ||
                typeof sendAction.delay === 'number',
              // tslint:disable-next-line:max-line-length
              `No delay reference for delay expression '${actionObject.delay}' was found on machine '${machine.machine.id}'`
            );
          }

          return sendAction;
        case actionTypes.log:
          return resolveLog(
            actionObject as LogAction<TContext, TEvent>,
            updatedContext,
            _event
          );
        case actionTypes.pure:
          return (
            (actionObject as PureAction<TContext, TEvent>).get(
              updatedContext,
              _event.data
            ) || []
          );
        default:
          return toActionObject(actionObject, machine.machine.options.actions);
      }
    })
  );

  const [raisedEvents, nonRaisedActions] = partition(
    resolvedActions,
    (
      action
    ): action is
      | RaiseActionObject<TEvent>
      | SendActionObject<TContext, TEvent> =>
      action.type === actionTypes.raise ||
      (action.type === actionTypes.send &&
        (action as SendActionObject<TContext, TEvent>).to ===
          SpecialTargets.Internal)
  );

  let children = currentState ? currentState.children : [];
  for (const action of resolvedActions) {
    if (action.type === actionTypes.start) {
      children.push(createInvocableActor((action as any).actor));
    } else if (action.type === actionTypes.stop) {
      children = children.filter(childActor => {
        return (
          childActor.id !==
          (action as ActivityActionObject<TContext, TEvent>).actor.id
        );
      });
    }
  }

  const resolvedConfiguration = resolvedStateValue
    ? stateTransition.configuration
    : currentState
    ? currentState.configuration
    : [];

  const meta = resolvedConfiguration.reduce(
    (acc, subStateNode) => {
      if (subStateNode.meta !== undefined) {
        acc[subStateNode.id] = subStateNode.meta;
      }
      return acc;
    },
    {} as Record<string, string>
  );

  const isDone = isInFinalState(resolvedConfiguration, machine);

  const nextState = new State<TContext, TEvent, any, TTypestate>({
    value: resolvedStateValue || currentState!.value,
    context: updatedContext,
    _event,
    // Persist _sessionid between states
    _sessionid: currentState ? currentState._sessionid : null,
    history:
      !resolvedStateValue || stateTransition.source ? currentState : undefined,
    actions: resolvedStateValue ? nonRaisedActions : [],
    meta: resolvedStateValue
      ? meta
      : currentState
      ? currentState.meta
      : undefined,
    events: [],
    configuration: resolvedConfiguration,
    transitions: stateTransition.transitions,
    children,
    done: isDone
  });

  nextState.changed =
    _event.name === actionTypes.update || !!assignActions.length;

  // Dispose of penultimate histories to prevent memory leaks
  const { history } = nextState;
  if (history) {
    delete history.history;
  }

  if (!resolvedStateValue) {
    return nextState;
  }

  let maybeNextState = nextState;

  if (!isDone) {
    const isTransient =
      machine.isTransient || configuration.some(sn => sn.isTransient);

    if (isTransient) {
      maybeNextState = resolveRaisedTransition(
        machine,
        maybeNextState,
        {
          type: actionTypes.nullEvent
        },
        _event
      );
    }

    while (raisedEvents.length) {
      const raisedEvent = raisedEvents.shift()!;
      maybeNextState = resolveRaisedTransition(
        machine,
        maybeNextState,
        raisedEvent._event,
        _event
      );
    }
  }

  // Detect if state changed
  const changed =
    maybeNextState.changed ||
    (history
      ? !!maybeNextState.actions.length ||
        !!assignActions.length ||
        typeof history.value !== typeof maybeNextState.value ||
        !stateValuesEqual(maybeNextState.value, history.value)
      : undefined);

  maybeNextState.changed = changed;

  // TODO: remove children if they are stopped
  maybeNextState.children = children;

  // Preserve original history after raised events
  maybeNextState.history = history;
  maybeNextState.historyValue = historyValue;

  return maybeNextState;
}

function resolveHistoryValue<TContext, TEvent extends EventObject>(
  currentState: State<TContext, TEvent, any, any> | undefined,
  exitSet: Array<StateNode<TContext, any, TEvent>>
): HistoryValue<TContext, TEvent> {
  const historyValue: Record<
    string,
    Array<StateNode<TContext, any, TEvent>>
  > = currentState ? currentState.historyValue : {};
  if (currentState && currentState.configuration) {
    // From SCXML algorithm: https://www.w3.org/TR/scxml/#exitStates
    for (const exitStateNode of new Set(exitSet)) {
      for (const historyNode of getHistoryNodes(exitStateNode)) {
        let predicate: (sn: StateNode<TContext, any, TEvent>) => boolean;
        if (historyNode.history === 'deep') {
          predicate = sn => isLeafNode(sn) && isDescendant(sn, exitStateNode);
        } else {
          predicate = sn => {
            return sn.parent === exitStateNode;
          };
        }
        historyValue[historyNode.id] = currentState.configuration.filter(
          predicate
        );
      }
    }
  }
  return historyValue;
}

/**
 * Resolves a partial state value with its full representation in the state node's machine.
 *
 * @param stateValue The partial state value to resolve.
 */
export function resolveStateValue<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: StateValue
): StateValue {
  if (!stateValue) {
    return stateNode.initialStateValue || {};
  }

  switch (stateNode.type) {
    case 'parallel':
      return mapValues(
        stateNode.initialStateValue as Record<string, StateValue>,
        (subStateValue, subStateKey) => {
          return subStateValue
            ? resolveStateValue(
                getStateNode(stateNode, subStateKey),
                stateValue[subStateKey] || subStateValue
              )
            : {};
        }
      );

    case 'compound':
      if (isString(stateValue)) {
        const subStateNode = getStateNode(stateNode, stateValue);

        if (
          subStateNode.type === 'parallel' ||
          subStateNode.type === 'compound'
        ) {
          return { [stateValue]: subStateNode.initialStateValue! };
        }

        return stateValue;
      }
      if (!keys(stateValue).length) {
        return stateNode.initialStateValue || {};
      }

      return mapValues(stateValue, (subStateValue, subStateKey) => {
        return subStateValue
          ? resolveStateValue(
              getStateNode(stateNode, subStateKey),
              subStateValue
            )
          : {};
      });

    default:
      return stateValue || {};
  }
}

export function stateValuesEqual(
  a: StateValue | undefined,
  b: StateValue | undefined
): boolean {
  if (a === b) {
    return true;
  }

  if (a === undefined || b === undefined) {
    return false;
  }

  if (isString(a) || isString(b)) {
    return a === b;
  }

  const aKeys = keys(a as StateValueMap);
  const bKeys = keys(b as StateValueMap);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every(key => stateValuesEqual(a[key], b[key]))
  );
}
