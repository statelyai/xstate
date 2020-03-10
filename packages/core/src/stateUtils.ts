import { EventObject, StateNode, StateValue, Actor } from '.';
import {
  keys,
  flatten,
  toStatePath,
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
  toSCXMLEvent
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
  Transitions,
  ActionObject,
  StateValueMap,
  AssignAction,
  RaiseAction,
  CancelAction,
  SendAction,
  LogAction,
  PureAction,
  RaiseActionObject,
  SendActionObject,
  SpecialTargets,
  ActivityActionObject,
  HistoryValue,
  InitialTransitionConfig,
  InitialTransitionDefinition,
  Event
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
  resolveCancel,
  toActionObject
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

export const isAtomicStateNode = (stateNode: StateNode<any, any, any>) =>
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
  const ancestors: Array<typeof stateNode> = [];

  // add all ancestors
  let m = stateNode.parent;
  while (m && m !== toStateNode) {
    ancestors.push(m);
    m = m.parent;
  }

  return ancestors;
}

export function getAllStateNodes<TC, TE extends EventObject>(
  stateNode: StateNode<TC, any, TE>
): Array<StateNode<TC, any, TE>> {
  const stateNodes = [stateNode];

  if (isAtomicStateNode(stateNode)) {
    return stateNodes;
  }

  return stateNodes.concat(
    flatten(getChildren(stateNode).map(getAllStateNodes))
  );
}

export function getConfiguration<TC, TE extends EventObject>(
  stateNodes: Iterable<StateNode<TC, any, TE>>
): Iterable<StateNode<TC, any, TE>> {
  const configuration = new Set(stateNodes);
  const mutConfiguration = new Set(stateNodes);

  const adjList = getAdjList(mutConfiguration);

  // add descendants
  for (const s of configuration) {
    // if previously active, add existing child nodes
    if (s.type === 'compound' && (!adjList.get(s) || !adjList.get(s)!.length)) {
      getInitialStateNodes(s).forEach(sn => mutConfiguration.add(sn));
    } else {
      if (s.type === 'parallel') {
        for (const child of getChildren(s)) {
          if (child.type === 'history') {
            continue;
          }

          if (!mutConfiguration.has(child)) {
            getInitialStateNodes(child).forEach(sn => mutConfiguration.add(sn));
          }
        }
      }
    }
  }

  // add all ancestors
  for (const s of mutConfiguration) {
    let m = s.parent;

    while (m) {
      mutConfiguration.add(m);
      m = m.parent;
    }
  }

  return mutConfiguration;
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
      if (isAtomicStateNode(childStateNode)) {
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

export function getStateValue<TC, TE extends EventObject>(
  rootNode: StateNode<TC, any, TE>,
  configuration: Configuration<TC, TE>
): StateValue {
  const config = getConfiguration(configuration);
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

export function formatTransition<TContext, TEvent extends EventObject>(
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
  const transition = {
    ...transitionConfig,
    actions: toActionObjects(toArray(transitionConfig.actions)),
    cond: toGuard(transitionConfig.cond, guards),
    target,
    source: stateNode,
    internal,
    eventType: transitionConfig.event,
    toJSON: () => ({
      ...transition,
      source: `#${stateNode.id}`,
      target: target ? target.map(t => `#${t.id}`) : undefined
    })
  };

  Object.defineProperty(transition, 'toJSON', {
    value: () => ({
      ...transition,
      target: transition.target
        ? transition.target.map(t => `#${t.id}`)
        : undefined,
      source: `#${stateNode.id}`
    })
  });

  return transition;
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

export function formatInitialTransition<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  _target: SingleOrArray<string> | InitialTransitionConfig<TContext, TEvent>
): InitialTransitionDefinition<TContext, TEvent> {
  if (isString(_target) || isArray(_target)) {
    const targets = toArray(_target).map(t => {
      // Resolve state string keys (which represent children)
      // to their state node
      const descStateNode = isString(t)
        ? isStateId(t)
          ? stateNode.machine.getStateNodeById(t)
          : stateNode.states[t]
        : t;

      if (!descStateNode) {
        throw new Error(
          `Initial state node "${t}" not found on parent state node #${stateNode.id}`
        );
      }

      if (!isDescendant(descStateNode, stateNode)) {
        throw new Error(
          `Invalid initial target: state node #${descStateNode.id} is not a descendant of #${stateNode.id}`
        );
      }

      return descStateNode;
    });
    const resolvedTarget = resolveTarget(stateNode, targets);

    const transition = {
      source: stateNode,
      actions: [],
      eventType: null as any,
      target: resolvedTarget!,
      toJSON: () => ({
        ...transition,
        source: `#${stateNode.id}`,
        target: resolvedTarget ? resolvedTarget.map(t => `#${t.id}`) : undefined
      })
    };

    return transition;
  }

  return formatTransition(stateNode, {
    target: toArray(_target.target).map(t => {
      if (isString(t)) {
        return isStateId(t) ? t : `${stateNode.machine.delimiter}${t}`;
      }

      return t;
    }),
    actions: _target.actions,
    event: null as any
  }) as InitialTransitionDefinition<TContext, TEvent>;
}

export function resolveTarget<TContext, TEvent extends EventObject>(
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

function resolveHistoryTarget<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent> & { type: 'history' }
): Array<StateNode<TContext, any, TEvent>> {
  const normalizedTarget = normalizeTarget<TContext, TEvent>(stateNode.target);
  if (!normalizedTarget) {
    return stateNode.parent!.initial.target;
  }
  return normalizedTarget.map(t =>
    typeof t === 'string' ? getStateNodeByPath(stateNode, t) : t
  );
}

function isHistoryNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>
): stateNode is StateNode<TContext, any, TEvent> & { type: 'history' } {
  return stateNode.type === 'history';
}

export function getInitialStateNodes<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>
): Array<StateNode<TContext, any, TEvent>> {
  const transitions = [
    {
      target: [stateNode],
      source: stateNode,
      actions: [],
      eventType: 'init'
    }
  ];
  const mutStatesToEnter = new Set<StateNode<TContext, any, TEvent>>();
  const mutStatesForDefaultEntry = new Set<StateNode<TContext, any, TEvent>>();

  computeEntrySet(
    transitions,
    State.from({}),
    mutStatesToEnter,
    mutStatesForDefaultEntry
  );

  return [...mutStatesToEnter];
}
export function getInitialState<
  TContext,
  TStateSchema,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  machine: MachineNode<TContext, TStateSchema, TEvent>
): State<TContext, TEvent, TStateSchema, TTypestate> {
  return resolveMicroTransition(machine, [], undefined, undefined);
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
  const stateValue =
    state instanceof State
      ? state.value
      : toStateValue(state, stateNode.machine.delimiter);

  if (isString(stateValue)) {
    return [stateNode.states[stateValue]];
  }

  const subStateKeys = keys(stateValue);
  const subStateNodes: Array<
    StateNode<TContext, any, TEvent>
  > = subStateKeys
    .map(subStateKey => getStateNode(stateNode, subStateKey))
    .filter(Boolean);

  return subStateNodes.concat(
    subStateKeys.reduce(
      (allSubStateNodes, subStateKey) => {
        const subStateNode = getStateNode(stateNode, subStateKey);
        if (!subStateNode) {
          return allSubStateNodes;
        }
        const subStateNodes = getStateNodes(
          subStateNode,
          stateValue[subStateKey]
        );

        return allSubStateNodes.concat(subStateNodes);
      },
      [] as Array<StateNode<TContext, any, TEvent>>
    )
  );
}

export function evaluateGuard<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, any, TEvent>,
  guard: Guard<TContext, TEvent>,
  context: TContext,
  _event: SCXML.Event<TEvent>,
  state: State<TContext, TEvent>
): boolean {
  const { guards } = machine.options;
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
      `Guard '${guard.type}' is not implemented on machine '${machine.id}'.`
    );
  }

  return condFn(context, _event.data, guardMeta);
}

export function transitionLeafNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: string,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): Transitions<TContext, TEvent> | undefined {
  const childStateNode = getStateNode(stateNode, stateValue);
  const next = childStateNode.next(state, _event);

  if (!next || !next.length) {
    return stateNode.next(state, _event);
  }

  return next;
}

export function transitionCompoundNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: StateValueMap,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): Transitions<TContext, TEvent> | undefined {
  const subStateKeys = keys(stateValue);

  const childStateNode = getStateNode(stateNode, subStateKeys[0]);
  const next = transitionNode(
    childStateNode,
    stateValue[subStateKeys[0]],
    state,
    _event
  );

  if (!next || !next.length) {
    return stateNode.next(state, _event);
  }

  return next;
}
export function transitionParallelNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: StateValueMap,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): Transitions<TContext, TEvent> | undefined {
  const transitionMap: Record<string, Transitions<TContext, TEvent>> = {};

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

  const transitions = keys(transitionMap).map(key => transitionMap[key]);
  const enabledTransitions = flatten(transitions);

  const willTransition = transitions.some(st => st.length > 0);

  if (!willTransition) {
    return stateNode.next(state, _event);
  }

  return enabledTransitions;
}

export function transitionNode<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  stateValue: StateValue,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): Transitions<TContext, TEvent> | undefined {
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

function hasIntersection<T>(s1: Iterable<T>, s2: Iterable<T>): boolean {
  const set1 = new Set(s1);
  const set2 = new Set(s2);

  for (const item of set1) {
    if (set2.has(item)) {
      return true;
    }
  }
  for (const item of set2) {
    if (set1.has(item)) {
      return true;
    }
  }
  return false;
}

export function removeConflictingTransitions<
  TContext,
  TEvent extends EventObject
>(
  enabledTransitions: Array<TransitionDefinition<TContext, TEvent>>,
  mutConfiguration: Set<StateNode<TContext, any, TEvent>>,
  state: State<TContext, TEvent>
) {
  const filteredTransitions = new Set<TransitionDefinition<TContext, TEvent>>();

  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = new Set<
      TransitionDefinition<TContext, TEvent>
    >();
    for (const t2 of filteredTransitions) {
      if (
        hasIntersection(
          computeExitSet([t1], mutConfiguration, state),
          computeExitSet([t2], mutConfiguration, state)
        )
      ) {
        if (isDescendant(t1.source, t2.source)) {
          transitionsToRemove.add(t2);
        } else {
          t1Preempted = true;
          break;
        }
      }
    }
    if (!t1Preempted) {
      for (const t3 of transitionsToRemove) {
        filteredTransitions.delete(t3);
      }
      filteredTransitions.add(t1);
    }
  }

  return filteredTransitions;
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
  if (!transition.target) {
    return [];
  }

  const targets = new Set<StateNode<TC, any, TE>>();

  for (const s of transition.target) {
    if (isHistoryNode(s)) {
      if (state.historyValue[s.id]) {
        state.historyValue[s.id].forEach(node => {
          targets.add(node);
        });
      } else {
        getEffectiveTargetStates(
          { target: resolveHistoryTarget(s) } as TransitionDefinition<TC, TE>,
          state
        ).forEach(node => {
          targets.add(node);
        });
      }
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
  mutConfiguration: Set<StateNode<TContext, any, TEvent>>,
  state: State<TContext, TEvent>
) {
  const statesToExit = computeExitSet(transitions, mutConfiguration, state);
  const actions: Array<ActionObject<TContext, TEvent>> = [];

  statesToExit.forEach(stateNode => {
    actions.push(...stateNode.invoke.map(def => stop(def)));
  });

  statesToExit.sort((a, b) => b.order - a.order);

  const historyValue = resolveHistoryValue(state, statesToExit);

  for (const s of statesToExit) {
    actions.push(...flatten(s.exit));
    mutConfiguration.delete(s);
  }

  return {
    exitSet: statesToExit,
    historyValue,
    actions,
    configuration: mutConfiguration
  };
}

export function enterStates<TContext, TEvent extends EventObject>(
  transitions: Array<TransitionDefinition<TContext, TEvent>>,
  mutConfiguration: Set<StateNode<TContext, any, TEvent>>,
  state: State<TContext, TEvent>
) {
  const statesToInvoke: typeof mutConfiguration = new Set();
  const internalQueue: Array<SCXML.Event<TEvent>> = [];

  const actions: Array<ActionObject<TContext, TEvent>> = [];
  const mutStatesToEnter = new Set<StateNode<TContext, any, TEvent>>();
  const mutStatesForDefaultEntry = new Set<StateNode<TContext, any, TEvent>>();

  computeEntrySet(
    transitions,
    state,
    mutStatesToEnter,
    mutStatesForDefaultEntry
  );

  for (const stateNodeToEnter of [...mutStatesToEnter].sort(
    (a, b) => a.order - b.order
  )) {
    mutConfiguration.add(stateNodeToEnter);
    statesToInvoke.add(stateNodeToEnter);

    // Add entry actions
    actions.push(...stateNodeToEnter.entry);

    if (mutStatesForDefaultEntry.has(stateNodeToEnter)) {
      mutStatesForDefaultEntry.forEach(stateNode => {
        actions.push(...stateNode.initial!.actions);
      });
    }
    // if (defaultHistoryContent[s.id]) {
    //   actions.push(...defaultHistoryContent[s.id])
    // }
    if (stateNodeToEnter.type === 'final') {
      const parent = stateNodeToEnter.parent!;
      internalQueue.push(
        toSCXMLEvent(
          done(
            parent!.id,
            stateNodeToEnter.data
              ? mapContext(stateNodeToEnter.data, state.context, state._event)
              : undefined
          )
        )
      );

      if (parent.parent) {
        const grandparent = parent.parent;

        if (grandparent.type === 'parallel') {
          if (
            getChildren(grandparent).every(parentNode =>
              isInFinalState([...mutConfiguration], parentNode)
            )
          ) {
            internalQueue.push(
              toSCXMLEvent(done(grandparent.id, grandparent.data))
            );
          }
        }
      }
    }
  }

  return {
    statesToInvoke,
    internalQueue,
    actions
  };
}

function computeExitSet<TContext, TEvent extends EventObject>(
  transitions: Array<TransitionDefinition<TContext, TEvent>>,
  configuration: Set<StateNode<TContext, any, TEvent>>,
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
  mutStatesToEnter: Set<StateNode<TContext, any, TEvent>>,
  mutStatesForDefaultEntry: Set<StateNode<TContext, any, TEvent>>
) {
  for (const t of transitions) {
    for (const s of t.target || []) {
      addDescendantStatesToEnter(
        s,
        state,
        mutStatesToEnter,
        mutStatesForDefaultEntry
      );
    }
    const ancestor = getTransitionDomain(t, state);
    const targetStates = getEffectiveTargetStates(t, state);
    for (const s of targetStates) {
      addAncestorStatesToEnter(
        s,
        ancestor,
        state,
        mutStatesToEnter,
        mutStatesForDefaultEntry
      );
    }
  }
}

function addDescendantStatesToEnter<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  state: State<TContext, TEvent>,
  mutStatesToEnter: Set<typeof stateNode>,
  mutStatesForDefaultEntry: Set<typeof stateNode>
) {
  if (isHistoryNode(stateNode)) {
    if (state.historyValue[stateNode.id]) {
      const historyStateNodes = state.historyValue[stateNode.id];
      for (const s of historyStateNodes) {
        addDescendantStatesToEnter(
          s,
          state,
          mutStatesToEnter,
          mutStatesForDefaultEntry
        );
      }
      for (const s of historyStateNodes) {
        addAncestorStatesToEnter(
          s,
          stateNode.parent!,
          state,
          mutStatesToEnter,
          mutStatesForDefaultEntry
        );
        mutStatesForDefaultEntry.forEach(stateForDefaultEntry =>
          mutStatesForDefaultEntry.add(stateForDefaultEntry)
        );
      }
    } else {
      const targets = resolveHistoryTarget(stateNode);
      for (const s of targets) {
        addDescendantStatesToEnter(
          s,
          state,
          mutStatesToEnter,
          mutStatesForDefaultEntry
        );
      }
      for (const s of targets) {
        addAncestorStatesToEnter(
          s,
          stateNode,
          state,
          mutStatesToEnter,
          mutStatesForDefaultEntry
        );
        mutStatesForDefaultEntry.forEach(stateForDefaultEntry =>
          mutStatesForDefaultEntry.add(stateForDefaultEntry)
        );
      }
    }
  } else {
    mutStatesToEnter.add(stateNode);
    if (stateNode.type === 'compound') {
      mutStatesForDefaultEntry.add(stateNode);
      const initialStates = stateNode.initial.target;

      for (const initialState of initialStates) {
        addDescendantStatesToEnter(
          initialState,
          state,
          mutStatesToEnter,
          mutStatesForDefaultEntry
        );
      }

      for (const initialState of initialStates) {
        addAncestorStatesToEnter(
          initialState,
          stateNode,
          state,
          mutStatesToEnter,
          mutStatesForDefaultEntry
        );
      }
    } else {
      if (stateNode.type === 'parallel') {
        for (const child of getChildren(stateNode).filter(
          sn => !isHistoryNode(sn)
        )) {
          if (![...mutStatesToEnter].some(s => isDescendant(s, child))) {
            addDescendantStatesToEnter(
              child,
              state,
              mutStatesToEnter,
              mutStatesForDefaultEntry
            );
          }
        }
      }
    }
  }
}

function addAncestorStatesToEnter<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  toStateNode: StateNode<TContext, any, TEvent> | null,
  state: State<TContext, TEvent>,
  mutStatesToEnter: Set<typeof stateNode>,
  mutStatesForDefaultEntry: Set<typeof stateNode>
) {
  const properAncestors = getProperAncestors(stateNode, toStateNode);
  for (const anc of properAncestors) {
    mutStatesToEnter.add(anc);
    if (anc.type === 'parallel') {
      for (const child of getChildren(anc).filter(sn => !isHistoryNode(sn))) {
        if (![...mutStatesToEnter].some(s => isDescendant(s, child))) {
          addDescendantStatesToEnter(
            child,
            state,
            mutStatesToEnter,
            mutStatesForDefaultEntry
          );
        }
      }
    }
  }
}

/**
 * https://www.w3.org/TR/scxml/#microstepProcedure
 *
 * @private
 * @param transitions
 * @param currentState
 * @param mutConfiguration
 */
export function microstep<TContext, TEvent extends EventObject>(
  transitions: Array<TransitionDefinition<TContext, TEvent>>,
  currentState: State<TContext, TEvent> | undefined,
  mutConfiguration: Set<StateNode<TContext, any, TEvent>>
): {
  actions: Array<ActionObject<TContext, TEvent>>;
  configuration: typeof mutConfiguration;
  historyValue: HistoryValue<TContext, TEvent>;
  internalQueue: Array<SCXML.Event<TEvent>>;
} {
  const actions: Array<ActionObject<TContext, TEvent>> = [];

  const filteredTransitions = Array.from(
    removeConflictingTransitions(
      transitions,
      mutConfiguration,
      currentState || State.from({})
    )
  );

  let historyValue: HistoryValue<TContext, TEvent> = {};

  // Exit states
  if (currentState) {
    const { historyValue: exitHistoryValue, actions: exitActions } = exitStates(
      filteredTransitions,
      mutConfiguration,
      currentState
    );

    actions.push(...exitActions);

    historyValue = exitHistoryValue;

    actions.push(...flatten(transitions.map(t => t.actions)));
  }

  // Enter states
  const res = enterStates(
    filteredTransitions,
    mutConfiguration,
    currentState || State.from({})
  );

  // internal queue events
  actions.push(
    ...res.internalQueue.map(event => raise<TContext, TEvent>(event.data))
  );

  actions.push(
    ...flatten(
      [...res.statesToInvoke].map(s =>
        s.invoke.map(invokeDef => start(invokeDef))
      )
    )
  );

  actions.push(...res.actions);

  return {
    actions,
    configuration: mutConfiguration,
    historyValue,
    internalQueue: res.internalQueue
  };
}

function selectEventlessTransitions<TContext, TEvent extends EventObject>(
  state: State<TContext, TEvent>,
  machine: MachineNode<TContext, any, TEvent>
): Transitions<TContext, TEvent> {
  const transientNodes = state.configuration.filter(sn => sn.isTransient);

  const transitions = flatten(transientNodes.map(sn => sn.transitions));
  return transitions.filter(t => {
    return (
      t.eventType === NULL_EVENT &&
      (t.cond === undefined ||
        evaluateGuard<TContext, TEvent>(
          machine,
          t.cond,
          state.context,
          toSCXMLEvent(NULL_EVENT as Event<TEvent>),
          state
        ))
    );
  });
}

export function resolveMicroTransition<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  machine: MachineNode<TContext, any, TEvent>,
  transitions: Transitions<TContext, TEvent>,
  currentState?: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent> = initEvent as SCXML.Event<TEvent>
): State<TContext, TEvent, any, TTypestate> {
  // Transition will "apply" if:
  // - the state node is the initial state (there is no current state)
  // - OR there are transitions
  const willTransition = !currentState || transitions.length > 0;

  const prevConfig = getConfiguration(
    currentState ? currentState.configuration : [machine]
  );

  const resolved = microstep(
    currentState
      ? transitions
      : [
          {
            target: [...prevConfig].filter(isAtomicStateNode),
            source: machine,
            actions: [],
            eventType: null as any
          }
        ],
    currentState,
    new Set(prevConfig)
  );

  if (currentState && !willTransition) {
    const inertState = State.inert(currentState, currentState.context);
    inertState.event = _event.data;
    inertState._event = _event;
    inertState.changed = _event.name === actionTypes.update;
    return inertState;
  }

  let children = currentState ? [...currentState.children] : ([] as Actor[]);

  for (const action of resolved.actions) {
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

  const resolvedConfiguration = willTransition
    ? Array.from(resolved.configuration)
    : currentState
    ? currentState.configuration
    : [];
  const isDone = isInFinalState(resolvedConfiguration, machine);

  const meta = resolvedConfiguration.reduce(
    (acc, subStateNode) => {
      if (subStateNode.meta !== undefined) {
        acc[subStateNode.id] = subStateNode.meta;
      }
      return acc;
    },
    {} as Record<string, string>
  );

  const currentContext = currentState ? currentState.context : machine.context;

  const { actions: resolvedActions, context } = resolveActionsAndContext(
    resolved.actions,
    machine,
    _event,
    currentState
  );

  const [raisedEventActions, nonRaisedActions] = partition(
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

  const nextState = new State<TContext, TEvent, any, TTypestate>({
    value: getStateValue(machine, resolved.configuration),
    context,
    _event,
    // Persist _sessionid between states
    _sessionid: currentState ? currentState._sessionid : null,
    history: currentState,
    actions: nonRaisedActions,
    meta,
    events: [],
    configuration: resolvedConfiguration,
    transitions,
    children,
    done: isDone,
    historyValue: resolved.historyValue
  });

  nextState.changed = !currentState
    ? undefined
    : !stateValuesEqual(nextState.value, currentState.value) ||
      _event.name === actionTypes.update ||
      nextState.actions.length > 0 ||
      context !== currentContext;
  nextState._internalQueue = resolved.internalQueue;
  nextState._internalQueue = raisedEventActions.map(r => r._event);

  const isTransient =
    [...resolvedConfiguration].some(sn => sn.isTransient) &&
    selectEventlessTransitions(nextState, machine).length;

  if (isTransient) {
    nextState._internalQueue.unshift({
      type: actionTypes.nullEvent
    });
  }

  // Dispose of penultimate histories to prevent memory leaks
  const { history } = nextState;
  if (history) {
    delete history.history;
  }

  return nextState;
}

function resolveActionsAndContext<TContext, TEvent extends EventObject>(
  actions: Array<ActionObject<TContext, TEvent>>,
  machine: MachineNode<TContext, any, TEvent, any>,
  _event: SCXML.Event<TEvent>,
  currentState: State<TContext, TEvent, any, any> | undefined
) {
  let context: TContext = currentState ? currentState.context : machine.context;
  const resActions: Array<ActionObject<TContext, TEvent>> = flatten(
    toActionObjects(actions, machine.options.actions).map(actionObject => {
      switch (actionObject.type) {
        case actionTypes.raise:
          return resolveRaise(actionObject as RaiseAction<TEvent>);
        case actionTypes.cancel:
          return resolveCancel(
            actionObject as CancelAction<TContext, TEvent>,
            context,
            _event
          );
        case actionTypes.send:
          const sendAction = resolveSend(
            actionObject as SendAction<TContext, TEvent>,
            context,
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
            context,
            _event
          );
        case actionTypes.pure:
          return (
            (actionObject as PureAction<TContext, TEvent>).get(
              context,
              _event.data
            ) || []
          );
        case actionTypes.assign:
          context = updateContext(
            context,
            _event,
            [actionObject as AssignAction<TContext, TEvent>],
            currentState
          );
          return actionObject;
        default:
          return toActionObject(actionObject, machine.machine.options.actions);
      }
    })
  );
  return { actions: resActions, context };
}

export function macrostep<TContext, TEvent extends EventObject>(
  state: State<TContext, TEvent, any, Typestate<TContext>>,
  event: Event<TEvent> | SCXML.Event<TEvent> | null,
  machine: MachineNode<TContext, any, TEvent, any>
): State<TContext, TEvent> {
  // Assume the state is at rest (no raised events)
  // Determine the next state based on the next microstep
  const nextState = event === null ? state : machine.microstep(state, event);

  const { _event, _internalQueue } = nextState;
  let maybeNextState = nextState;

  while (_internalQueue.length && !maybeNextState.done) {
    const raisedEvent = _internalQueue.shift()!;
    const currentActions = maybeNextState.actions;

    maybeNextState = machine.microstep(
      maybeNextState,
      raisedEvent as SCXML.Event<TEvent>
    );

    _internalQueue.unshift(...maybeNextState._internalQueue);

    // Save original event to state
    if (raisedEvent.type === NULL_EVENT) {
      maybeNextState._event = _event;
      maybeNextState.event = _event.data;
    }

    // Since macrostep actions have not been executed yet,
    // prioritize them in the action queue
    maybeNextState.actions.unshift(...currentActions);
  }

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
    for (const exitStateNode of exitSet) {
      for (const historyNode of getHistoryNodes(exitStateNode)) {
        let predicate: (sn: StateNode<TContext, any, TEvent>) => boolean;
        if (historyNode.history === 'deep') {
          predicate = sn =>
            isAtomicStateNode(sn) && isDescendant(sn, exitStateNode);
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
  rootNode: StateNode<TContext, any, TEvent>,
  stateValue: StateValue
): StateValue {
  const configuration = getConfiguration(
    getStateNodes(rootNode.machine, stateValue)
  );
  return getStateValue(rootNode, [...configuration]);
}

export function toState<TContext, TEvent extends EventObject>(
  state: StateValue | State<TContext, TEvent>,
  machine: MachineNode<TContext, any, TEvent>
): State<TContext, TEvent> {
  if (state instanceof State) {
    return state;
  } else {
    const resolvedStateValue = resolveStateValue(machine, state);
    const resolvedContext = machine.context!;

    return machine.resolveState(
      State.from<TContext, TEvent>(resolvedStateValue, resolvedContext)
    );
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
