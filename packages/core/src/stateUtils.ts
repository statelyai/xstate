import {
  flatten,
  toStatePath,
  toArray,
  warn,
  isArray,
  isFunction,
  isString,
  toTransitionConfigArray,
  normalizeTarget,
  toStateValue,
  mapContext,
  toSCXMLEvent,
  isBuiltInEvent
} from './utils';
import {
  BaseActionObject,
  EventObject,
  InvokeActionObject,
  StopActionObject,
  StateValue,
  TransitionConfig,
  TransitionDefinition,
  DelayedTransitionDefinition,
  SingleOrArray,
  DelayExpr,
  SCXML,
  Transitions,
  StateValueMap,
  RaiseActionObject,
  HistoryValue,
  InitialTransitionConfig,
  InitialTransitionDefinition,
  MachineContext
} from './types';
import { State } from './State';
import {
  after,
  done,
  toActionObjects,
  initEvent,
  actionTypes,
  toActionObject,
  resolveActionObject
} from './actions';
import { send } from './actions/send';
import { cancel } from './actions/cancel';
import { invoke } from './actions/invoke';
import { stop } from './actions/stop';
import { IS_PRODUCTION } from './environment';
import { STATE_IDENTIFIER, NULL_EVENT, WILDCARD } from './constants';
import { evaluateGuard, toGuardDefinition } from './guards';
import {
  ExecutableAction,
  isExecutableAction
} from '../actions/ExecutableAction';
import type { StateNode } from './StateNode';
import { isDynamicAction } from '../actions/dynamicAction';
import {
  ActorContext,
  AnyState,
  AnyStateMachine,
  AnyStateNode,
  SendActionObject,
  StateFromMachine
} from '.';
import { execAction } from './exec';

type Configuration<
  TContext extends MachineContext,
  TE extends EventObject
> = Iterable<StateNode<TContext, TE>>;

type AdjList<TContext extends MachineContext, TE extends EventObject> = Map<
  StateNode<TContext, TE>,
  Array<StateNode<TContext, TE>>
>;

const isAtomicStateNode = (stateNode: StateNode<any, any>) =>
  stateNode.type === 'atomic' || stateNode.type === 'final';

function getChildren<TContext extends MachineContext, TE extends EventObject>(
  stateNode: StateNode<TContext, TE>
): Array<StateNode<TContext, TE>> {
  return Object.keys(stateNode.states)
    .map((key) => stateNode.states[key])
    .filter((sn) => sn.type !== 'history');
}

function getProperAncestors<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  toStateNode: StateNode<TContext, TEvent> | null
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

export function getConfiguration<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNodes: Iterable<StateNode<TContext, TEvent>>
): Set<StateNode<TContext, TEvent>> {
  const configuration = new Set(stateNodes);
  const configurationSet = new Set(stateNodes);

  const adjList = getAdjList(configurationSet);

  // add descendants
  for (const s of configuration) {
    // if previously active, add existing child nodes
    if (s.type === 'compound' && (!adjList.get(s) || !adjList.get(s)!.length)) {
      getInitialStateNodes(s).forEach((sn) => configurationSet.add(sn));
    } else {
      if (s.type === 'parallel') {
        for (const child of getChildren(s)) {
          if (child.type === 'history') {
            continue;
          }

          if (!configurationSet.has(child)) {
            getInitialStateNodes(child).forEach((sn) =>
              configurationSet.add(sn)
            );
          }
        }
      }
    }
  }

  // add all ancestors
  for (const s of configurationSet) {
    let m = s.parent;

    while (m) {
      configurationSet.add(m);
      m = m.parent;
    }
  }

  return configurationSet;
}

function getValueFromAdj<
  TContext extends MachineContext,
  TE extends EventObject
>(
  baseNode: StateNode<TContext, TE>,
  adjList: AdjList<TContext, TE>
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
  childStateNodes.forEach((csn) => {
    stateValue[csn.key] = getValueFromAdj(csn, adjList);
  });

  return stateValue;
}

export function getAdjList<
  TContext extends MachineContext,
  TE extends EventObject
>(configuration: Configuration<TContext, TE>): AdjList<TContext, TE> {
  const adjList: AdjList<TContext, TE> = new Map();

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

export function getStateValue<
  TContext extends MachineContext,
  TE extends EventObject
>(
  rootNode: StateNode<TContext, TE>,
  configuration: Configuration<TContext, TE>
): StateValue {
  const config = getConfiguration(configuration);
  return getValueFromAdj(rootNode, getAdjList(config));
}

export function isInFinalState<
  TContext extends MachineContext,
  TE extends EventObject
>(
  configuration: Array<StateNode<TContext, TE>>,
  stateNode: StateNode<TContext, TE> = configuration[0].machine.root
): boolean {
  if (stateNode.type === 'compound') {
    return getChildren(stateNode).some(
      (s) => s.type === 'final' && configuration.includes(s)
    );
  }
  if (stateNode.type === 'parallel') {
    return getChildren(stateNode).every((sn) =>
      isInFinalState(configuration, sn)
    );
  }

  return false;
}

export const isStateId = (str: string) => str[0] === STATE_IDENTIFIER;

export function getCandidates<TEvent extends EventObject>(
  stateNode: StateNode<any, TEvent>,
  receivedEventType: TEvent['type'],
  /**
   * If `true`, will use SCXML event partial token matching semantics
   * without the need for the ".*" suffix
   */
  partialMatch: boolean = false
): Array<TransitionDefinition<any, TEvent>> {
  const candidates = stateNode.transitions.filter((transition) => {
    const { eventType } = transition;
    // First, check the trivial case: event names are exactly equal
    if (eventType === receivedEventType) {
      return true;
    }

    // Then, check if transition is a wildcard transition,
    // which matches any non-transient events
    if (eventType === WILDCARD) {
      return true;
    }

    if (!partialMatch && !eventType.endsWith('.*')) {
      return false;
    }

    if (!IS_PRODUCTION) {
      warn(
        !/.*\*.+/.test(eventType),
        `Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "${eventType}" event.`
      );
    }

    const partialEventTokens = eventType.split('.');
    const eventTokens = receivedEventType.split('.');

    for (
      let tokenIndex = 0;
      tokenIndex < partialEventTokens.length;
      tokenIndex++
    ) {
      const partialEventToken = partialEventTokens[tokenIndex];
      const eventToken = eventTokens[tokenIndex];

      if (partialEventToken === '*') {
        const isLastToken = tokenIndex === partialEventTokens.length - 1;

        if (!IS_PRODUCTION) {
          warn(
            isLastToken,
            `Infix wildcards in transition events are not allowed. Check the "${eventType}" event.`
          );
        }

        return isLastToken;
      }

      if (partialEventToken !== eventToken) {
        return false;
      }
    }

    return true;
  });

  return candidates;
}
/**
 * All delayed transitions from the config.
 */
export function getDelayedTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>
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
        Object.keys(afterConfig).map((delay, i) => {
          const configTransition = afterConfig[delay];
          const resolvedTransition = isString(configTransition)
            ? { target: configTransition }
            : configTransition;
          const resolvedDelay = !isNaN(+delay) ? +delay : delay;
          const eventType = mutateEntryExit(resolvedDelay, i);
          return toArray(resolvedTransition).map((transition) => ({
            ...transition,
            event: eventType,
            delay: resolvedDelay
          }));
        })
      );
  return delayedTransitions.map((delayedTransition) => {
    const { delay } = delayedTransition;
    return {
      ...formatTransition(stateNode, delayedTransition),
      delay
    };
  });
}

export function formatTransition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  transitionConfig: TransitionConfig<TContext, TEvent> & {
    event: TEvent['type'] | typeof NULL_EVENT | '*';
  }
): TransitionDefinition<TContext, TEvent> {
  const normalizedTarget = normalizeTarget(transitionConfig.target);
  const internal =
    'internal' in transitionConfig
      ? transitionConfig.internal
      : normalizedTarget
      ? normalizedTarget.some(
          (_target) =>
            isString(_target) && _target[0] === stateNode.machine.delimiter
        )
      : true;
  const { guards } = stateNode.machine.options;
  const target = resolveTarget(stateNode, normalizedTarget);
  if (!IS_PRODUCTION && (transitionConfig as any).cond) {
    throw new Error(
      `State "${stateNode.id}" has declared \`cond\` for one of its transitions. This property has been renamed to \`guard\`. Please update your code.`
    );
  }
  const transition = {
    ...transitionConfig,
    actions: toActionObjects(toArray(transitionConfig.actions)),
    guard: transitionConfig.guard
      ? toGuardDefinition(
          transitionConfig.guard,
          (guardType) => guards[guardType]
        )
      : undefined,
    target,
    source: stateNode,
    internal,
    eventType: transitionConfig.event,
    toJSON: () => ({
      ...transition,
      source: `#${stateNode.id}`,
      target: target ? target.map((t) => `#${t.id}`) : undefined
    })
  };

  return transition;
}

export function formatTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>
): Array<TransitionDefinition<TContext, TEvent>> {
  const transitionConfigs: Array<
    TransitionConfig<TContext, TEvent> & {
      event: string;
    }
  > = [];
  if (Array.isArray(stateNode.config.on)) {
    transitionConfigs.push(...stateNode.config.on);
  } else if (stateNode.config.on) {
    const {
      [WILDCARD]: wildcardConfigs = [],
      ...namedTransitionConfigs
    } = stateNode.config.on;
    Object.keys(namedTransitionConfigs).forEach((eventType) => {
      if (eventType === NULL_EVENT) {
        throw new Error(
          'Null events ("") cannot be specified as a transition key. Use `always: { ... }` instead.'
        );
      }
      const eventTransitionConfigs = toTransitionConfigArray<TContext, TEvent>(
        eventType,
        namedTransitionConfigs![eventType as string]
      );

      transitionConfigs.push(...eventTransitionConfigs);
      // TODO: add dev-mode validation for unreachable transitions
    });
    transitionConfigs.push(
      ...toTransitionConfigArray(
        WILDCARD,
        wildcardConfigs as SingleOrArray<
          TransitionConfig<TContext, TEvent> & {
            event: '*';
          }
        >
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
    stateNode.invoke.map((invokeDef) => {
      const settleTransitions: any[] = [];
      if (invokeDef.onDone) {
        settleTransitions.push(
          ...toTransitionConfigArray(
            `done.invoke.${invokeDef.id}`,
            invokeDef.onDone
          )
        );
      }
      if (invokeDef.onError) {
        settleTransitions.push(
          ...toTransitionConfigArray(
            `error.platform.${invokeDef.id}`,
            invokeDef.onError
          )
        );
      }
      if (invokeDef.onSnapshot) {
        settleTransitions.push(
          ...toTransitionConfigArray(
            `xstate.snapshot.${invokeDef.id}`,
            invokeDef.onSnapshot
          )
        );
      }
      return settleTransitions;
    })
  );
  const delayedTransitions = stateNode.after;
  const formattedTransitions = flatten(
    [...doneConfig, ...invokeConfig, ...transitionConfigs].map(
      (
        transitionConfig: TransitionConfig<TContext, TEvent> & {
          event: TEvent['type'] | '*';
        }
      ) =>
        toArray(transitionConfig).map((transition) =>
          formatTransition(stateNode, transition)
        )
    )
  );
  for (const delayedTransition of delayedTransitions) {
    formattedTransitions.push(delayedTransition as any);
  }
  return formattedTransitions;
}

export function formatInitialTransition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  _target: SingleOrArray<string> | InitialTransitionConfig<TContext, TEvent>
): InitialTransitionDefinition<TContext, TEvent> {
  if (isString(_target) || isArray(_target)) {
    const targets = toArray(_target).map((t) => {
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
        target: resolvedTarget
          ? resolvedTarget.map((t) => `#${t.id}`)
          : undefined
      })
    };

    return transition;
  }

  return formatTransition(stateNode, {
    target: toArray(_target.target).map((t) => {
      if (isString(t)) {
        return isStateId(t) ? t : `${stateNode.machine.delimiter}${t}`;
      }

      return t;
    }),
    actions: _target.actions,
    event: null as any
  }) as InitialTransitionDefinition<TContext, TEvent>;
}

export function resolveTarget<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  _target: Array<string | StateNode<TContext, TEvent>> | undefined
): Array<StateNode<TContext, TEvent>> | undefined {
  if (_target === undefined) {
    // an undefined target signals that the state node should not transition from that state when receiving that event
    return undefined;
  }
  return _target.map((target) => {
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

function resolveHistoryTarget<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent> & { type: 'history' }
): Array<StateNode<TContext, TEvent>> {
  const normalizedTarget = normalizeTarget<TContext, TEvent>(stateNode.target);
  if (!normalizedTarget) {
    return stateNode.parent!.initial.target;
  }
  return normalizedTarget.map((t) =>
    typeof t === 'string'
      ? getStateNodeByPath<TContext, TEvent>(stateNode, t)
      : t
  );
}

function isHistoryNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>
): stateNode is StateNode<TContext, TEvent> & { type: 'history' } {
  return stateNode.type === 'history';
}

export function getInitialStateNodes<
  TContext extends MachineContext,
  TEvent extends EventObject
>(stateNode: StateNode<TContext, TEvent>): Array<StateNode<TContext, TEvent>> {
  const set = new Set<AnyStateNode>();

  function iter(descStateNode: AnyStateNode): void {
    if (set.has(descStateNode)) {
      return;
    }
    set.add(descStateNode);
    if (descStateNode.type === 'compound') {
      for (const targetStateNode of descStateNode.initial.target) {
        let m = targetStateNode.parent;

        while (m && m !== targetStateNode) {
          if (m === stateNode) break;
          set.add(m);
          m = m.parent;
        }
        iter(targetStateNode);
      }
    } else if (descStateNode.type === 'parallel') {
      for (const child of getChildren(descStateNode)) {
        iter(child);
      }
    }
  }

  iter(stateNode);

  return [...set];
}
/**
 * Returns the child state node from its relative `stateKey`, or throws.
 */
export function getStateNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  stateKey: string
): StateNode<TContext, TEvent> {
  if (isStateId(stateKey)) {
    return stateNode.machine.getStateNodeById(stateKey);
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
 * Returns the relative state node from the given `statePath`, or throws.
 *
 * @param statePath The string or string array relative path to the state node.
 */
function getStateNodeByPath<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  statePath: string | string[]
): StateNode<TContext, TEvent> {
  if (typeof statePath === 'string' && isStateId(statePath)) {
    try {
      return stateNode.machine.getStateNodeById(statePath);
    } catch (e) {
      // try individual paths
      // throw e;
    }
  }
  const arrayStatePath = toStatePath(
    statePath,
    stateNode.machine.delimiter
  ).slice();
  let currentStateNode: StateNode<TContext, TEvent> = stateNode;
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
export function getStateNodes<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  state: StateValue | State<TContext, TEvent>
): Array<StateNode<TContext, TEvent>> {
  const stateValue =
    state instanceof State
      ? state.value
      : toStateValue(state, stateNode.machine.delimiter);

  if (isString(stateValue)) {
    return [stateNode, stateNode.states[stateValue]];
  }

  const childStateKeys = Object.keys(stateValue);
  const childStateNodes: Array<
    StateNode<TContext, TEvent>
  > = childStateKeys
    .map((subStateKey) => getStateNode(stateNode, subStateKey))
    .filter(Boolean);

  return [stateNode.machine.root, stateNode].concat(
    childStateNodes,
    childStateKeys.reduce((allSubStateNodes, subStateKey) => {
      const subStateNode = getStateNode(stateNode, subStateKey);
      if (!subStateNode) {
        return allSubStateNodes;
      }
      const subStateNodes = getStateNodes(
        subStateNode,
        stateValue[subStateKey]
      );

      return allSubStateNodes.concat(subStateNodes);
    }, [] as Array<StateNode<TContext, TEvent>>)
  );
}

export function transitionLeafNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
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

export function transitionCompoundNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  stateValue: StateValueMap,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): Transitions<TContext, TEvent> | undefined {
  const subStateKeys = Object.keys(stateValue);

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
export function transitionParallelNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  stateValue: StateValueMap,
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>
): Transitions<TContext, TEvent> | undefined {
  const transitionMap: Record<string, Transitions<TContext, TEvent>> = {};

  for (const subStateKey of Object.keys(stateValue)) {
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

  const transitions = Object.keys(transitionMap).map(
    (key) => transitionMap[key]
  );
  const enabledTransitions = flatten(transitions);

  const willTransition = transitions.some((st) => st.length > 0);

  if (!willTransition) {
    return stateNode.next(state, _event);
  }

  return enabledTransitions;
}

export function transitionNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: StateNode<TContext, TEvent>,
  stateValue: StateValue,
  state: State<TContext, TEvent, any>,
  _event: SCXML.Event<TEvent>
): Transitions<TContext, TEvent> | undefined {
  // leaf node
  if (isString(stateValue)) {
    return transitionLeafNode(stateNode, stateValue, state, _event);
  }

  // compound node
  if (Object.keys(stateValue).length === 1) {
    return transitionCompoundNode(stateNode, stateValue, state, _event);
  }

  // parallel node
  return transitionParallelNode(stateNode, stateValue, state, _event);
}

function getHistoryNodes<
  TContext extends MachineContext,
  TEvent extends EventObject
>(stateNode: StateNode<TContext, TEvent>): Array<StateNode<TContext, TEvent>> {
  return Object.keys(stateNode.states)
    .map((key) => stateNode.states[key])
    .filter((sn) => sn.type === 'history');
}

function isDescendant<TC extends MachineContext, TE extends EventObject>(
  childStateNode: StateNode<TC, TE>,
  parentStateNode: StateNode<TC, TE>
): boolean {
  let marker = childStateNode;
  while (marker.parent && marker.parent !== parentStateNode) {
    marker = marker.parent;
  }

  return marker.parent === parentStateNode;
}

function getPathFromRootToNode<
  TC extends MachineContext,
  TE extends EventObject
>(stateNode: StateNode<TC, TE>): Array<StateNode<TC, TE>> {
  const path: Array<StateNode<TC, TE>> = [];
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
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  enabledTransitions: Array<TransitionDefinition<TContext, TEvent>>,
  configuration: Set<StateNode<TContext, TEvent>>,
  historyValue: HistoryValue<TContext, TEvent>
): Array<TransitionDefinition<TContext, TEvent>> {
  const filteredTransitions = new Set<TransitionDefinition<TContext, TEvent>>();

  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = new Set<
      TransitionDefinition<TContext, TEvent>
    >();
    for (const t2 of filteredTransitions) {
      if (
        hasIntersection(
          computeExitSet([t1], configuration, historyValue),
          computeExitSet([t2], configuration, historyValue)
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

  return Array.from(filteredTransitions);
}

function findLCCA<TContext extends MachineContext, TEvent extends EventObject>(
  stateNodes: Array<StateNode<TContext, TEvent>>
): StateNode<TContext, TEvent> {
  const [head] = stateNodes;

  let current = getPathFromRootToNode(head);
  let candidates: Array<StateNode<TContext, TEvent>> = [];

  stateNodes.forEach((stateNode) => {
    const path = getPathFromRootToNode(stateNode);

    candidates = current.filter((sn) => path.includes(sn));
    current = candidates;
    candidates = [];
  });

  return current[current.length - 1];
}

function getEffectiveTargetStates<
  TC extends MachineContext,
  TE extends EventObject
>(
  transition: TransitionDefinition<TC, TE>,
  historyValue: HistoryValue<TC, TE>
): Array<StateNode<TC, TE>> {
  if (!transition.target) {
    return [];
  }

  const targets = new Set<StateNode<TC, TE>>();

  for (const s of transition.target) {
    if (isHistoryNode(s)) {
      if (historyValue[s.id]) {
        historyValue[s.id].forEach((node) => {
          targets.add(node);
        });
      } else {
        getEffectiveTargetStates(
          { target: resolveHistoryTarget<TC, TE>(s) } as TransitionDefinition<
            TC,
            TE
          >,
          historyValue
        ).forEach((node) => {
          targets.add(node);
        });
      }
    } else {
      targets.add(s);
    }
  }

  return [...targets];
}

function getTransitionDomain<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  transition: TransitionDefinition<TContext, TEvent>,
  historyValue: HistoryValue<TContext, TEvent>
): StateNode<TContext, TEvent> | null {
  const targetStates = getEffectiveTargetStates(transition, historyValue);

  if (!targetStates) {
    return null;
  }

  if (
    transition.internal &&
    transition.source.type === 'compound' &&
    targetStates.every((targetStateNode) =>
      isDescendant(targetStateNode, transition.source)
    )
  ) {
    return transition.source;
  }

  const lcca = findLCCA(targetStates.concat(transition.source));

  return lcca;
}

function computeExitSet(
  transitions: Array<TransitionDefinition<any, any>>,
  configuration: Set<AnyStateNode>,
  historyValue: HistoryValue<any, any>
): Array<AnyStateNode> {
  const statesToExit = new Set<AnyStateNode>();

  for (const t of transitions) {
    if (t.target && t.target.length) {
      const domain = getTransitionDomain(t, historyValue);

      for (const s of configuration) {
        if (isDescendant(s, domain!)) {
          statesToExit.add(s);
        }
      }
    }
  }

  return [...statesToExit];
}

/**
 * https://www.w3.org/TR/scxml/#microstepProcedure
 *
 * @private
 * @param transitions
 * @param currentState
 * @param mutConfiguration
 */
export function microstep<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  transitions: Array<TransitionDefinition<TContext, TEvent>>,
  currentState: State<TContext, TEvent>,
  mutConfiguration: Set<StateNode<TContext, TEvent>>,
  _event: SCXML.Event<TEvent>,
  actorCtx: ActorContext<any, any> | undefined
): typeof currentState {
  const { context, machine } = currentState;
  const actions: BaseActionObject[] = [];

  const filteredTransitions = removeConflictingTransitions(
    transitions,
    mutConfiguration,
    currentState.historyValue
  );

  let historyValue: HistoryValue<TContext, TEvent> = {};

  const internalQueue: Array<SCXML.Event<TEvent>> = [];

  // Exit states
  if (!currentState._initial) {
    const { historyValue: exitHistoryValue, actions: exitActions } = exitStates(
      filteredTransitions
    );

    actions.push(...exitActions);
    historyValue = exitHistoryValue;
  }

  // Transition
  const transitionActions = flatten(filteredTransitions.map((t) => t.actions));

  actions.push(...transitionActions);

  // Enter states
  const enterStatesResult = enterStates();

  // Start invocations
  for (const stateToInvoke of enterStatesResult.statesToInvoke) {
    for (const invokeDef of stateToInvoke.invoke) {
      actions.push(invoke(invokeDef));
    }
  }

  actions.push(...enterStatesResult.actions);

  const nextConfiguration = [...mutConfiguration];

  if (isInFinalState(nextConfiguration)) {
    const finalActions = flatten(
      nextConfiguration
        .sort((a, b) => b.order - a.order)
        .map((state) => state.exit)
    );
    actions.push(...finalActions);
  }

  try {
    const {
      actions: resolvedActions,
      raised,
      context: resolvedContext
    } = resolveActionsAndContext(
      actions,
      _event,
      currentState,
      context,
      actorCtx
    );

    internalQueue.push(...enterStatesResult.internalQueue);
    internalQueue.push(...raised.map((a) => a.params._event));

    return currentState.clone({
      actions: resolvedActions,
      configuration: Array.from(mutConfiguration),
      historyValue,
      _internalQueue: internalQueue,
      context: resolvedContext,
      _event
    });
  } catch (e) {
    // TODO: Refactor this once proper error handling is implemented.
    // See https://github.com/statelyai/rfcs/pull/4
    if (machine.config.scxml) {
      return currentState.clone({
        actions: [],
        configuration: Array.from(mutConfiguration),
        historyValue,
        _internalQueue: [toSCXMLEvent({ type: 'error.execution' } as TEvent)],
        context: machine.context
      });
    } else {
      throw e;
    }
  }

  function enterStates() {
    const statesToInvoke: typeof mutConfiguration = new Set();
    const internalQueue: Array<SCXML.Event<TEvent>> = [];

    const actions: BaseActionObject[] = [];
    const statesToEnter = new Set<AnyStateNode>();
    const statesForDefaultEntry = new Set<AnyStateNode>();

    const { historyValue } = currentState;
    computeEntrySet(filteredTransitions);

    for (const stateNodeToEnter of [...statesToEnter].sort(
      (a, b) => a.order - b.order
    )) {
      mutConfiguration.add(stateNodeToEnter);
      statesToInvoke.add(stateNodeToEnter);

      // Add entry actions
      actions.push(...stateNodeToEnter.entry);

      if (statesForDefaultEntry.has(stateNodeToEnter)) {
        statesForDefaultEntry.forEach((stateNode) => {
          const initialActions = stateNode.initial!.actions;
          actions.push(...initialActions);
        });
      }
      // if (defaultHistoryContent[s.id]) {
      //   actions.push(...defaultHistoryContent[s.id])
      // }
      if (stateNodeToEnter.type === 'final') {
        const parent = stateNodeToEnter.parent!;

        if (!parent.parent) {
          continue;
        }

        internalQueue.push(
          toSCXMLEvent(
            done(
              parent!.id,
              stateNodeToEnter.doneData
                ? mapContext(
                    stateNodeToEnter.doneData,
                    currentState.context,
                    currentState._event
                  )
                : undefined
            )
          )
        );

        if (parent.parent) {
          const grandparent = parent.parent;

          if (grandparent.type === 'parallel') {
            if (
              getChildren(grandparent).every((parentNode) =>
                isInFinalState([...mutConfiguration], parentNode)
              )
            ) {
              internalQueue.push(toSCXMLEvent(done(grandparent.id)));
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

    // Internal functions
    function computeEntrySet<
      TContext extends MachineContext,
      TEvent extends EventObject
    >(transitions: Array<TransitionDefinition<TContext, TEvent>>) {
      for (const t of transitions) {
        for (const s of t.target || []) {
          addDescendantStatesToEnter(s);
        }
        const ancestor = getTransitionDomain(t, historyValue);
        const targetStates = getEffectiveTargetStates(t, historyValue);
        for (const s of targetStates) {
          addAncestorStatesToEnter(s, ancestor);
        }
      }
    }

    function addDescendantStatesToEnter<
      TContext extends MachineContext,
      TEvent extends EventObject
    >(stateNode: StateNode<TContext, TEvent>) {
      if (isHistoryNode(stateNode)) {
        if (historyValue[stateNode.id]) {
          const historyStateNodes = historyValue[stateNode.id];
          for (const s of historyStateNodes) {
            addDescendantStatesToEnter(s);
          }
          for (const s of historyStateNodes) {
            addAncestorStatesToEnter(s, stateNode.parent!);
            statesForDefaultEntry.forEach((stateForDefaultEntry) =>
              statesForDefaultEntry.add(stateForDefaultEntry)
            );
          }
        } else {
          const targets = resolveHistoryTarget<TContext, TEvent>(stateNode);
          for (const s of targets) {
            addDescendantStatesToEnter(s);
          }
          for (const s of targets) {
            addAncestorStatesToEnter(s, stateNode);
            statesForDefaultEntry.forEach((stateForDefaultEntry) =>
              statesForDefaultEntry.add(stateForDefaultEntry)
            );
          }
        }
      } else {
        statesToEnter.add(stateNode);
        if (stateNode.type === 'compound') {
          statesForDefaultEntry.add(stateNode);
          const initialStates = stateNode.initial.target;

          for (const initialState of initialStates) {
            addDescendantStatesToEnter(initialState);
          }

          for (const initialState of initialStates) {
            addAncestorStatesToEnter(initialState, stateNode);
          }
        } else {
          if (stateNode.type === 'parallel') {
            for (const child of getChildren(stateNode).filter(
              (sn) => !isHistoryNode(sn)
            )) {
              if (![...statesToEnter].some((s) => isDescendant(s, child))) {
                addDescendantStatesToEnter(child);
              }
            }
          }
        }
      }
    }

    function addAncestorStatesToEnter(
      stateNode: AnyStateNode,
      toStateNode: AnyStateNode | null
    ) {
      const properAncestors = getProperAncestors(stateNode, toStateNode);
      for (const anc of properAncestors) {
        statesToEnter.add(anc);
        if (anc.type === 'parallel') {
          for (const child of getChildren(anc).filter(
            (sn) => !isHistoryNode(sn)
          )) {
            if (![...statesToEnter].some((s) => isDescendant(s, child))) {
              addDescendantStatesToEnter(child);
            }
          }
        }
      }
    }
  }

  function exitStates(transitions: Array<TransitionDefinition<any, any>>) {
    const statesToExit = computeExitSet(
      transitions,
      mutConfiguration,
      currentState.historyValue
    );
    const actions: BaseActionObject[] = [];

    statesToExit.forEach((stateNode) => {
      actions.push(...stateNode.invoke.map((def) => stop(def.id)));
    });

    statesToExit.sort((a, b) => b.order - a.order);

    const historyValue: Record<string, Array<AnyStateNode>> = currentState
      ? currentState.historyValue
      : {};
    if (currentState && currentState.configuration) {
      // From SCXML algorithm: https://www.w3.org/TR/scxml/#exitStates
      for (const exitStateNode of statesToExit) {
        for (const historyNode of getHistoryNodes(exitStateNode)) {
          let predicate: (sn: AnyStateNode) => boolean;
          if (historyNode.history === 'deep') {
            predicate = (sn) =>
              isAtomicStateNode(sn) && isDescendant(sn, exitStateNode);
          } else {
            predicate = (sn) => {
              return sn.parent === exitStateNode;
            };
          }
          historyValue[historyNode.id] = currentState.configuration.filter(
            predicate
          );
        }
      }
    }

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
}

export function resolveMicroTransition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  transitions: Transitions<TContext, TEvent>,
  currentState: State<TContext, TEvent, any>,
  actorCtx: ActorContext<any, any> | undefined,
  _event: SCXML.Event<TEvent> = initEvent as SCXML.Event<TEvent>
): State<TContext, TEvent, any> {
  const { machine } = currentState;
  // Transition will "apply" if:
  // - the state node is the initial state (there is no current state)
  // - OR there are transitions
  const willTransition = currentState._initial || transitions.length > 0;

  const prevConfiguration = getConfiguration<TContext, TEvent>(
    !currentState._initial ? currentState.configuration : [machine.root]
  );

  if (!currentState._initial && !willTransition) {
    const inertState = currentState.clone({
      _event,
      actions: [],
      transitions: []
    });

    inertState.changed = false;
    return inertState;
  }

  const microstate = microstep<TContext, TEvent>(
    currentState._initial
      ? [
          {
            target: [...prevConfiguration].filter(isAtomicStateNode),
            source: machine.root,
            actions: [],
            eventType: null as any,
            toJSON: null as any // TODO: fix
          }
        ]
      : transitions,
    currentState,
    prevConfiguration,
    _event,
    actorCtx
  );

  const { context, actions: nonRaisedActions } = microstate;

  const children = { ...currentState.children };
  setChildren();

  const nextState = microstate.clone({
    value: {}, // TODO: make optional
    transitions,
    children
  });

  nextState.changed = currentState._initial
    ? undefined
    : !stateValuesEqual(nextState.value, currentState.value) ||
      _event.name === actionTypes.update ||
      nextState.actions.length > 0 ||
      context !== currentState.context;

  return nextState;

  function setChildren() {
    nonRaisedActions.forEach((action) => {
      if (
        action.type === actionTypes.invoke &&
        (action as InvokeActionObject).params.ref
      ) {
        const ref = (action as InvokeActionObject).params.ref;
        if (ref) {
          children[ref.name] = ref;
        }
      } else if (action.type === actionTypes.stop) {
        const ref = (action as StopActionObject).params.actor;
        if (ref) {
          delete children[ref.name];
        }
      }
    });
  }
}

export function resolveActionsAndContext<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  actions: BaseActionObject[],
  _event: SCXML.Event<TEvent>,
  currentState: State<TContext, TEvent, any>,
  context: TContext,
  actorCtx: ActorContext<any, any> | undefined
): {
  actions: typeof actions;
  raised: Array<RaiseActionObject<TEvent>>;
  context: TContext;
} {
  const { machine } = currentState;
  const resolvedActions: BaseActionObject[] = [];
  const raiseActions: Array<RaiseActionObject<TEvent>> = [];
  const preservedContexts: [TContext, ...TContext[]] = [context];

  function resolveAction(actionObject: BaseActionObject) {
    const executableActionObject = resolveActionObject(
      actionObject,
      machine.options.actions
    );

    if (isDynamicAction(executableActionObject)) {
      if (
        executableActionObject.type === actionTypes.pure ||
        executableActionObject.type === actionTypes.choose
      ) {
        const matchedActions = executableActionObject.resolve(
          executableActionObject,
          context,
          _event,
          {
            machine,
            state: currentState!,
            action: actionObject,
            actorContext: actorCtx
          }
        ).params.actions;

        if (matchedActions) {
          toActionObjects(
            toArray(matchedActions),
            machine.options.actions
          ).forEach(resolveAction);
        }
      } else if (executableActionObject.type === actionTypes.assign) {
        const resolvedActionObject = executableActionObject.resolve(
          executableActionObject,
          context,
          _event,
          {
            machine,
            state: currentState!,
            action: actionObject,
            actorContext: actorCtx
          }
        );

        context = resolvedActionObject.params.context;
        preservedContexts.push(resolvedActionObject.params.context);
        resolvedActions.push(resolvedActionObject);
        for (const spawnAction of resolvedActionObject.params.actions) {
          resolveAction(spawnAction);
        }
        // } else if (executableActionObject.type === actionTypes.invoke) {
      } else {
        const resolvedActionObject = executableActionObject.resolve(
          executableActionObject,
          context,
          _event,
          {
            machine,
            state: currentState!,
            action: actionObject,
            actorContext: actorCtx
          }
        );

        if (
          resolvedActionObject.type === actionTypes.raise ||
          (resolvedActionObject.type === actionTypes.send &&
            actorCtx &&
            (resolvedActionObject as SendActionObject).params.to ===
              actorCtx.self)
        ) {
          raiseActions.push(resolvedActionObject);
        } else {
          resolvedActions.push(resolvedActionObject);
          // TODO: only using actorCtx.exec as a flag to execute; actually use it for execution
          if (actorCtx?.exec) {
            execAction(resolvedActionObject, currentState, actorCtx);
          }
        }
      }
      return;
    }
    const contextIndex = preservedContexts.length - 1;
    if (isExecutableAction(executableActionObject)) {
      executableActionObject.setContext(preservedContexts[contextIndex]);
      resolvedActions.push(executableActionObject);
    } else {
      const resolvedActionObject = toActionObject(
        executableActionObject,
        machine.options.actions
      );

      const actionExec = new ExecutableAction(resolvedActionObject);
      actionExec.setContext(preservedContexts[contextIndex]);

      resolvedActions.push(actionExec);
    }
    const resolvedAction = resolvedActions[resolvedActions.length - 1];
    // TODO: only using actorCtx.exec as a flag to execute; actually use it for execution
    if (actorCtx?.exec) {
      execAction(
        resolvedAction,
        currentState.clone({
          context: preservedContexts[preservedContexts.length - 1],
          _event
        }),
        actorCtx
      );
    }
  }

  for (const actionObject of actions) {
    resolveAction(actionObject);
  }

  return {
    actions: resolvedActions,
    raised: raiseActions,
    context
  };
}

export function macrostep<TMachine extends AnyStateMachine>(
  state: StateFromMachine<TMachine>,
  scxmlEvent: SCXML.Event<TMachine['__TEvent']>,
  actorCtx: ActorContext<any, any> | undefined
): typeof state {
  let nextState = state;
  // Handle stop event
  if (scxmlEvent?.name === 'xstate.stop') {
    return stopStep(scxmlEvent);
  }

  // Assume the state is at rest (no raised events)
  // Determine the next state based on the next microstep
  nextState =
    scxmlEvent === initEvent
      ? state
      : machineMicrostep(state, scxmlEvent, actorCtx);

  const { _internalQueue } = nextState;

  while (!nextState.done) {
    const eventlessTransitions = selectEventlessTransitions();

    if (eventlessTransitions.length === 0) {
      // TODO: this is a bit of a hack, we need to review this
      // this matches the behavior from v4 for eventless transitions
      // where for `hasAlwaysTransitions` we were always trying to resolve with a NULL event
      // and if a transition was not selected the `state.transitions` stayed empty
      // without this we get into an infinite loop in the dieHard test in `@xstate/test` for the `simplePathsTo`
      if (nextState.configuration.some((state) => state.always)) {
        nextState.transitions = [];
      }

      if (!_internalQueue.length) {
        break;
      } else {
        const internalEvent = _internalQueue.shift()!;
        const currentActions = nextState.actions;

        nextState = machineMicrostep(nextState, internalEvent, actorCtx);

        _internalQueue.push(...nextState._internalQueue);

        // Since macrostep actions have not been executed yet,
        // prioritize them in the action queue
        nextState.actions.unshift(...currentActions);
      }
    } else {
      const currentActions = nextState.actions;
      nextState = resolveMicroTransition(
        eventlessTransitions,
        nextState,
        actorCtx,
        nextState._event
      );
      _internalQueue.push(...nextState._internalQueue);
      nextState.actions.unshift(...currentActions);
    }
  }

  if (nextState.done) {
    // Perform the stop step to ensure that child actors are stopped
    stopStep(nextState._event);
  }

  return nextState;

  // Functions
  function stopStep(scxmlEvent: SCXML.Event<any>): typeof nextState {
    const stoppedState = nextState.clone({
      _event: scxmlEvent,
      actions: []
    });

    stoppedState.actions.length = 0;

    nextState.configuration
      .sort((a, b) => b.order - a.order)
      .forEach((stateNode) => {
        for (const action of stateNode.definition.exit) {
          stoppedState.actions.push(action);
        }
      });

    Object.values(nextState.children).forEach((child) => {
      stoppedState.actions.push(stop(() => child));
    });

    const { actions, context } = resolveActionsAndContext(
      stoppedState.actions,
      stoppedState._event,
      stoppedState,
      stoppedState.context,
      actorCtx
    );

    stoppedState.actions = actions;
    stoppedState.context = context;

    return stoppedState;
  }

  function selectEventlessTransitions(): TransitionDefinition<any, any>[] {
    const enabledTransitions: Set<TransitionDefinition<any, any>> = new Set();

    const atomicStates = nextState.configuration.filter(isAtomicStateNode);

    for (const stateNode of atomicStates) {
      loop: for (const s of [stateNode].concat(
        getProperAncestors(stateNode, null)
      )) {
        if (!s.always) {
          continue;
        }
        for (const transition of s.always) {
          if (
            transition.guard === undefined ||
            evaluateGuard(
              transition.guard,
              nextState.context,
              nextState._event,
              nextState
            )
          ) {
            enabledTransitions.add(transition);
            break loop;
          }
        }
      }
    }

    return removeConflictingTransitions(
      Array.from(enabledTransitions),
      new Set(nextState.configuration),
      nextState.historyValue
    );
  }
}

/**
 * Resolves a partial state value with its full representation in the state node's machine.
 *
 * @param stateValue The partial state value to resolve.
 */
export function resolveStateValue<
  TContext extends MachineContext,
  TEvent extends EventObject
>(rootNode: StateNode<TContext, TEvent>, stateValue: StateValue): StateValue {
  const configuration = getConfiguration(getStateNodes(rootNode, stateValue));
  return getStateValue(rootNode, [...configuration]);
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

  const aKeys = Object.keys(a as StateValueMap);
  const bKeys = Object.keys(b as StateValueMap);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => stateValuesEqual(a[key], b[key]))
  );
}

export function machineMicrostep(
  state: AnyState,
  _event: SCXML.Event<any>,
  actorCtx: ActorContext<any, any> | undefined
): typeof state {
  const { machine } = state;
  if (!IS_PRODUCTION && _event.name === WILDCARD) {
    throw new Error(`An event cannot have the wildcard type ('${WILDCARD}')`);
  }

  if (machine.strict) {
    if (
      !machine.root.events.includes(_event.name) &&
      !isBuiltInEvent(_event.name)
    ) {
      throw new Error(
        `Machine '${machine.key}' does not accept event '${_event.name}'`
      );
    }
  }

  const transitions = machine.getTransitionData(state, _event);

  return resolveMicroTransition(transitions, state, actorCtx, _event);
}
