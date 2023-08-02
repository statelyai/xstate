import isDevelopment from '#is-development';
import { State, cloneState } from './State.ts';
import type { StateNode } from './StateNode.ts';
import { after, done, raise } from './actions.ts';
import { cancel } from './actions/cancel.ts';
import { invoke } from './actions/invoke.ts';
import { stop } from './actions/stop.ts';
import { stopSignalType } from './actors/index.ts';
import {
  INIT_TYPE,
  NULL_EVENT,
  STATE_DELIMITER,
  STATE_IDENTIFIER,
  WILDCARD
} from './constants.ts';
import { evaluateGuard, toGuardDefinition } from './guards.ts';
import { ActorStatus } from './interpreter.ts';
import {
  Action,
  ActionArgs,
  AnyActorContext,
  AnyEventObject,
  AnyHistoryValue,
  AnyState,
  AnyStateNode,
  AnyTransitionDefinition,
  DelayExpr,
  DelayedTransitionDefinition,
  EventObject,
  HistoryValue,
  InitialTransitionConfig,
  InitialTransitionDefinition,
  MachineContext,
  SingleOrArray,
  StateValue,
  StateValueMap,
  TransitionConfig,
  TransitionDefinition,
  TODO,
  AnyActorRef
} from './types.ts';
import {
  isArray,
  mapContext,
  normalizeTarget,
  toArray,
  toStatePath,
  toStateValue,
  toTransitionConfigArray
} from './utils.ts';

type Configuration<
  TContext extends MachineContext,
  TE extends EventObject
> = Iterable<StateNode<TContext, TE>>;
type AnyConfiguration = Configuration<any, any>;

type AdjList = Map<AnyStateNode, Array<AnyStateNode>>;

function getOutput<TContext extends MachineContext, TEvent extends EventObject>(
  configuration: StateNode<TContext, TEvent>[],
  context: TContext,
  event: TEvent,
  self: AnyActorRef
) {
  const machine = configuration[0].machine;
  const finalChildStateNode = configuration.find(
    (stateNode) =>
      stateNode.type === 'final' && stateNode.parent === machine.root
  );

  return finalChildStateNode && finalChildStateNode.output
    ? mapContext(finalChildStateNode.output, context, event, self)
    : undefined;
}

export const isAtomicStateNode = (stateNode: StateNode<any, any>) =>
  stateNode.type === 'atomic' || stateNode.type === 'final';

function getChildren<TContext extends MachineContext, TE extends EventObject>(
  stateNode: StateNode<TContext, TE>
): Array<StateNode<TContext, TE>> {
  return Object.values(stateNode.states).filter((sn) => sn.type !== 'history');
}

function getProperAncestors(
  stateNode: AnyStateNode,
  toStateNode: AnyStateNode | null
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

export function getConfiguration(
  stateNodes: Iterable<AnyStateNode>
): Set<AnyStateNode> {
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
            for (const initialStateNode of getInitialStateNodes(child)) {
              configurationSet.add(initialStateNode);
            }
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

function getValueFromAdj(baseNode: AnyStateNode, adjList: AdjList): StateValue {
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

  const stateValue: StateValue = {};
  for (const childStateNode of childStateNodes) {
    stateValue[childStateNode.key] = getValueFromAdj(childStateNode, adjList);
  }

  return stateValue;
}

export function getAdjList<
  TContext extends MachineContext,
  TE extends EventObject
>(configuration: Configuration<TContext, TE>): AdjList {
  const adjList: AdjList = new Map();

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

export function getStateValue(
  rootNode: AnyStateNode,
  configuration: AnyConfiguration
): StateValue {
  const config = getConfiguration(configuration);
  return getValueFromAdj(rootNode, getAdjList(config));
}

export function isInFinalState(
  configuration: Array<AnyStateNode>,
  stateNode: AnyStateNode = configuration[0].machine.root
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
  receivedEventType: TEvent['type']
): Array<TransitionDefinition<any, TEvent>> {
  const candidates =
    stateNode.transitions.get(receivedEventType) ||
    [...stateNode.transitions.keys()]
      .filter((descriptor) => {
        // check if transition is a wildcard transition,
        // which matches any non-transient events
        if (descriptor === WILDCARD) {
          return true;
        }

        if (!descriptor.endsWith('.*')) {
          return false;
        }

        if (isDevelopment && /.*\*.+/.test(descriptor)) {
          console.warn(
            `Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "${descriptor}" event.`
          );
        }

        const partialEventTokens = descriptor.split('.');
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

            if (isDevelopment && !isLastToken) {
              console.warn(
                `Infix wildcards in transition events are not allowed. Check the "${descriptor}" transition.`
              );
            }

            return isLastToken;
          }

          if (partialEventToken !== eventToken) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => b.length - a.length)
      .flatMap((key) => stateNode.transitions.get(key)!);

  return candidates;
}

/**
 * All delayed transitions from the config.
 */
export function getDelayedTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode
): Array<DelayedTransitionDefinition<TContext, TEvent>> {
  const afterConfig = stateNode.config.after;
  if (!afterConfig) {
    return [];
  }

  const mutateEntryExit = (
    delay: string | number | DelayExpr<TContext, TEvent>,
    i: number
  ) => {
    const delayRef =
      typeof delay === 'function' ? `${stateNode.id}:delay[${i}]` : delay;
    const eventType = after(delayRef, stateNode.id);
    stateNode.entry.push(
      raise({ type: eventType } as TEvent, { id: eventType, delay })
    );
    stateNode.exit.push(cancel(eventType));
    return eventType;
  };

  const delayedTransitions = isArray(afterConfig)
    ? afterConfig.map((transition, i) => {
        const eventType = mutateEntryExit(transition.delay, i);
        return { ...transition, event: eventType };
      })
    : Object.keys(afterConfig).flatMap((delay, i) => {
        const configTransition = afterConfig[delay];
        const resolvedTransition =
          typeof configTransition === 'string'
            ? { target: configTransition }
            : configTransition;
        const resolvedDelay = !isNaN(+delay) ? +delay : delay;
        const eventType = mutateEntryExit(resolvedDelay, i);
        return toArray(resolvedTransition).map((transition) => ({
          ...transition,
          event: eventType,
          delay: resolvedDelay
        }));
      });
  return delayedTransitions.map((delayedTransition) => {
    const { delay } = delayedTransition;
    return {
      ...formatTransition(
        stateNode,
        delayedTransition.event,
        delayedTransition
      ),
      delay
    };
  });
}

export function formatTransition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  descriptor: string,
  transitionConfig: TransitionConfig<TContext, TEvent>
): AnyTransitionDefinition {
  const normalizedTarget = normalizeTarget(transitionConfig.target);
  const reenter = transitionConfig.reenter ?? false;
  const { guards } = stateNode.machine.implementations;
  const target = resolveTarget(stateNode, normalizedTarget);

  // TODO: should this be part of a lint rule instead?
  if (isDevelopment && (transitionConfig as any).cond) {
    throw new Error(
      `State "${stateNode.id}" has declared \`cond\` for one of its transitions. This property has been renamed to \`guard\`. Please update your code.`
    );
  }
  const transition = {
    ...transitionConfig,
    actions: toArray(transitionConfig.actions),
    guard: transitionConfig.guard
      ? toGuardDefinition(
          transitionConfig.guard,
          (guardType) => guards[guardType]
        )
      : undefined,
    target,
    source: stateNode,
    reenter,
    eventType: descriptor,
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
  stateNode: AnyStateNode
): Map<string, TransitionDefinition<TContext, TEvent>[]> {
  const transitions = new Map<
    string,
    TransitionDefinition<TContext, AnyEventObject>[]
  >();
  if (stateNode.config.on) {
    for (const descriptor of Object.keys(stateNode.config.on)) {
      if (descriptor === NULL_EVENT) {
        throw new Error(
          'Null events ("") cannot be specified as a transition key. Use `always: { ... }` instead.'
        );
      }
      const transitionsConfig = stateNode.config.on[descriptor];
      transitions.set(
        descriptor,
        toTransitionConfigArray(transitionsConfig).map((t) =>
          formatTransition(stateNode, descriptor, t)
        )
      );
    }
  }
  if (stateNode.config.onDone) {
    const descriptor = String(done(stateNode.id));
    transitions.set(
      descriptor,
      toTransitionConfigArray(stateNode.config.onDone).map((t) =>
        formatTransition(stateNode, descriptor, t)
      )
    );
  }
  for (const invokeDef of stateNode.invoke) {
    if (invokeDef.onDone) {
      const descriptor = `done.invoke.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onDone).map((t) =>
          formatTransition(stateNode, descriptor, t)
        )
      );
    }
    if (invokeDef.onError) {
      const descriptor = `error.platform.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onError).map((t) =>
          formatTransition(stateNode, descriptor, t)
        )
      );
    }
    if (invokeDef.onSnapshot) {
      const descriptor = `xstate.snapshot.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onSnapshot).map((t) =>
          formatTransition(stateNode, descriptor, t)
        )
      );
    }
  }
  for (const delayedTransition of stateNode.after) {
    let existing = transitions.get(delayedTransition.eventType);
    if (!existing) {
      existing = [];
      transitions.set(delayedTransition.eventType, existing);
    }
    existing.push(delayedTransition);
  }
  return transitions as Map<string, TransitionDefinition<TContext, any>[]>;
}

export function formatInitialTransition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  _target: SingleOrArray<string> | InitialTransitionConfig<TContext, TEvent>
): InitialTransitionDefinition<TContext, TEvent> {
  if (typeof _target === 'string' || isArray(_target)) {
    const targets = toArray(_target).map((t) => {
      // Resolve state string keys (which represent children)
      // to their state node
      const descStateNode =
        typeof t === 'string'
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
      reenter: false,
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

  return formatTransition(stateNode, '__INITIAL__', {
    target: toArray(_target.target).map((t) => {
      if (typeof t === 'string') {
        return isStateId(t) ? t : `${STATE_DELIMITER}${t}`;
      }

      return t;
    }),
    actions: _target.actions
  }) as InitialTransitionDefinition<TContext, TEvent>;
}

export function resolveTarget(
  stateNode: AnyStateNode,
  targets: Array<string | AnyStateNode> | undefined
): Array<AnyStateNode> | undefined {
  if (targets === undefined) {
    // an undefined target signals that the state node should not transition from that state when receiving that event
    return undefined;
  }
  return targets.map((target) => {
    if (typeof target !== 'string') {
      return target;
    }
    if (isStateId(target)) {
      return stateNode.machine.getStateNodeById(target);
    }

    const isInternalTarget = target[0] === STATE_DELIMITER;
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
      } catch (err: any) {
        throw new Error(
          `Invalid transition definition for state node '${stateNode.id}':\n${err.message}`
        );
      }
    } else {
      throw new Error(
        `Invalid target: "${target}" is not a valid target from the root node. Did you mean ".${target}"?`
      );
    }
  });
}

function resolveHistoryTarget<
  TContext extends MachineContext,
  TEvent extends EventObject
>(stateNode: AnyStateNode & { type: 'history' }): Array<AnyStateNode> {
  const normalizedTarget = normalizeTarget<TContext, TEvent>(stateNode.target);
  if (!normalizedTarget) {
    return stateNode.parent!.initial.target;
  }
  return normalizedTarget.map((t) =>
    typeof t === 'string' ? getStateNodeByPath(stateNode.parent!, t) : t
  );
}

function isHistoryNode(
  stateNode: AnyStateNode
): stateNode is AnyStateNode & { type: 'history' } {
  return stateNode.type === 'history';
}

export function getInitialStateNodes(
  stateNode: AnyStateNode
): Array<AnyStateNode> {
  const set = new Set<AnyStateNode>();

  function iter(descStateNode: AnyStateNode): void {
    if (set.has(descStateNode)) {
      return;
    }
    set.add(descStateNode);
    if (descStateNode.type === 'compound') {
      for (const targetStateNode of descStateNode.initial.target) {
        for (const a of getProperAncestors(targetStateNode, stateNode)) {
          set.add(a);
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
export function getStateNode(
  stateNode: AnyStateNode,
  stateKey: string
): AnyStateNode {
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
export function getStateNodeByPath(
  stateNode: AnyStateNode,
  statePath: string | string[]
): AnyStateNode {
  if (typeof statePath === 'string' && isStateId(statePath)) {
    try {
      return stateNode.machine.getStateNodeById(statePath);
    } catch (e) {
      // try individual paths
      // throw e;
    }
  }
  const arrayStatePath = toStatePath(statePath).slice();
  let currentStateNode: AnyStateNode = stateNode;
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
  stateNode: AnyStateNode,
  state: StateValue | State<TContext, TEvent, TODO>
): Array<AnyStateNode> {
  const stateValue = state instanceof State ? state.value : toStateValue(state);

  if (typeof stateValue === 'string') {
    return [stateNode, stateNode.states[stateValue]];
  }

  const childStateKeys = Object.keys(stateValue);
  const childStateNodes: Array<AnyStateNode> = childStateKeys
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
    }, [] as Array<AnyStateNode>)
  );
}

export function transitionAtomicNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  stateValue: string,
  state: State<TContext, TEvent, TODO>,
  event: TEvent
): Array<TransitionDefinition<TContext, TEvent>> | undefined {
  const childStateNode = getStateNode(stateNode, stateValue);
  const next = childStateNode.next(state, event);

  if (!next || !next.length) {
    return stateNode.next(state, event);
  }

  return next;
}

export function transitionCompoundNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  stateValue: StateValueMap,
  state: State<TContext, TEvent, TODO>,
  event: TEvent
): Array<TransitionDefinition<TContext, TEvent>> | undefined {
  const subStateKeys = Object.keys(stateValue);

  const childStateNode = getStateNode(stateNode, subStateKeys[0]);
  const next = transitionNode(
    childStateNode,
    stateValue[subStateKeys[0]],
    state,
    event
  );

  if (!next || !next.length) {
    return stateNode.next(state, event);
  }

  return next;
}

export function transitionParallelNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  stateValue: StateValueMap,
  state: State<TContext, TEvent, TODO>,
  event: TEvent
): Array<TransitionDefinition<TContext, TEvent>> | undefined {
  const allInnerTransitions: Array<TransitionDefinition<TContext, TEvent>> = [];

  for (const subStateKey of Object.keys(stateValue)) {
    const subStateValue = stateValue[subStateKey];

    if (!subStateValue) {
      continue;
    }

    const subStateNode = getStateNode(stateNode, subStateKey);
    const innerTransitions = transitionNode(
      subStateNode,
      subStateValue,
      state,
      event
    );
    if (innerTransitions) {
      allInnerTransitions.push(...innerTransitions);
    }
  }
  if (!allInnerTransitions.length) {
    return stateNode.next(state, event);
  }

  return allInnerTransitions;
}

export function transitionNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  stateValue: StateValue,
  state: State<TContext, TEvent, TODO, any>,
  event: TEvent
): Array<TransitionDefinition<TContext, TEvent>> | undefined {
  // leaf node
  if (typeof stateValue === 'string') {
    return transitionAtomicNode(stateNode, stateValue, state, event);
  }

  // compound node
  if (Object.keys(stateValue).length === 1) {
    return transitionCompoundNode(stateNode, stateValue, state, event);
  }

  // parallel node
  return transitionParallelNode(stateNode, stateValue, state, event);
}

function getHistoryNodes(stateNode: AnyStateNode): Array<AnyStateNode> {
  return Object.keys(stateNode.states)
    .map((key) => stateNode.states[key])
    .filter((sn) => sn.type === 'history');
}

function isDescendant(
  childStateNode: AnyStateNode,
  parentStateNode: AnyStateNode
): boolean {
  let marker = childStateNode;
  while (marker.parent && marker.parent !== parentStateNode) {
    marker = marker.parent;
  }

  return marker.parent === parentStateNode;
}

function getPathFromRootToNode(stateNode: AnyStateNode): Array<AnyStateNode> {
  const path: Array<AnyStateNode> = [];
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

export function removeConflictingTransitions(
  enabledTransitions: Array<AnyTransitionDefinition>,
  configuration: Set<AnyStateNode>,
  historyValue: AnyHistoryValue
): Array<AnyTransitionDefinition> {
  const filteredTransitions = new Set<AnyTransitionDefinition>();

  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = new Set<AnyTransitionDefinition>();
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

function findLCCA(stateNodes: Array<AnyStateNode>): AnyStateNode {
  const [head] = stateNodes;

  let current = getPathFromRootToNode(head);
  let candidates: Array<AnyStateNode> = [];

  for (const stateNode of stateNodes) {
    const path = getPathFromRootToNode(stateNode);

    candidates = current.filter((sn) => path.includes(sn));
    current = candidates;
    candidates = [];
  }

  return current[current.length - 1];
}

function getEffectiveTargetStates(
  transition: AnyTransitionDefinition,
  historyValue: AnyHistoryValue
): Array<AnyStateNode> {
  if (!transition.target) {
    return [];
  }

  const targets = new Set<AnyStateNode>();

  for (const targetNode of transition.target) {
    if (isHistoryNode(targetNode)) {
      if (historyValue[targetNode.id]) {
        for (const node of historyValue[targetNode.id]) {
          targets.add(node);
        }
      } else {
        for (const node of getEffectiveTargetStates(
          {
            target: resolveHistoryTarget(targetNode)
          } as AnyTransitionDefinition,
          historyValue
        )) {
          targets.add(node);
        }
      }
    } else {
      targets.add(targetNode);
    }
  }

  return [...targets];
}

function getTransitionDomain(
  transition: AnyTransitionDefinition,
  historyValue: AnyHistoryValue
): AnyStateNode | null {
  const targetStates = getEffectiveTargetStates(transition, historyValue);

  if (!targetStates) {
    return null;
  }

  if (
    !transition.reenter &&
    transition.source.type !== 'parallel' &&
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
  transitions: AnyTransitionDefinition[],
  configuration: Set<AnyStateNode>,
  historyValue: AnyHistoryValue
): Array<AnyStateNode> {
  const statesToExit = new Set<AnyStateNode>();

  for (const t of transitions) {
    if (t.target?.length) {
      const domain = getTransitionDomain(t, historyValue);

      for (const stateNode of configuration) {
        if (isDescendant(stateNode, domain!)) {
          statesToExit.add(stateNode);
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
  currentState: State<TContext, TEvent, TODO, any>,
  actorCtx: AnyActorContext,
  event: TEvent,
  isInitial: boolean
): State<TContext, TEvent, TODO, any> {
  const mutConfiguration = new Set(currentState.configuration);

  if (!transitions.length) {
    return currentState;
  }

  const microstate = microstepProcedure(
    transitions,
    currentState,
    mutConfiguration,
    event,
    actorCtx,
    isInitial
  );

  return cloneState(microstate, {
    value: {} // TODO: make optional
  });
}

function microstepProcedure(
  transitions: Array<AnyTransitionDefinition>,
  currentState: AnyState,
  mutConfiguration: Set<AnyStateNode>,
  event: AnyEventObject,
  actorCtx: AnyActorContext,
  isInitial: boolean
): typeof currentState {
  const actions: Action<any, any, any>[] = [];
  const historyValue = {
    ...currentState.historyValue
  };

  const filteredTransitions = removeConflictingTransitions(
    transitions,
    mutConfiguration,
    historyValue
  );

  const internalQueue = [...currentState._internalQueue];

  // Exit states
  if (!isInitial) {
    exitStates(filteredTransitions, mutConfiguration, historyValue, actions);
  }

  // Execute transition content
  actions.push(...filteredTransitions.flatMap((t) => t.actions));

  // Enter states
  enterStates(
    event,
    filteredTransitions,
    mutConfiguration,
    actions,
    internalQueue,
    currentState,
    historyValue,
    isInitial,
    actorCtx
  );

  const nextConfiguration = [...mutConfiguration];

  const done = isInFinalState(nextConfiguration);

  if (done) {
    const finalActions = nextConfiguration
      .sort((a, b) => b.order - a.order)
      .flatMap((state) => state.exit);
    actions.push(...finalActions);
  }

  try {
    const nextState = resolveActionsAndContext(
      actions,
      event,
      currentState,
      actorCtx
    );

    internalQueue.push(...nextState._internalQueue);

    return cloneState(currentState, {
      configuration: nextConfiguration,
      historyValue,
      _internalQueue: internalQueue,
      context: nextState.context,
      status: done
        ? {
            status: 'done',
            output: getOutput(
              nextConfiguration,
              nextState.context,
              event,
              actorCtx.self
            )
          }
        : currentState.status,
      children: nextState.children
    });
  } catch (e) {
    // TODO: Refactor this once proper error handling is implemented.
    // See https://github.com/statelyai/rfcs/pull/4
    throw e;
  }
}

function enterStates(
  event: AnyEventObject,
  filteredTransitions: AnyTransitionDefinition[],
  mutConfiguration: Set<AnyStateNode>,
  actions: Action<any, any, any>[],
  internalQueue: AnyEventObject[],
  currentState: AnyState,
  historyValue: HistoryValue<any, any>,
  isInitial: boolean,
  actorContext: AnyActorContext
): void {
  const statesToEnter = new Set<AnyStateNode>();
  const statesForDefaultEntry = new Set<AnyStateNode>();

  computeEntrySet(
    filteredTransitions,
    historyValue,
    statesForDefaultEntry,
    statesToEnter
  );

  // In the initial state, the root state node is "entered".
  if (isInitial) {
    statesForDefaultEntry.add(currentState.machine.root);
  }

  for (const stateNodeToEnter of [...statesToEnter].sort(
    (a, b) => a.order - b.order
  )) {
    mutConfiguration.add(stateNodeToEnter);

    for (const invokeDef of stateNodeToEnter.invoke) {
      actions.push(invoke(invokeDef));
    }

    // Add entry actions
    actions.push(...stateNodeToEnter.entry);

    if (statesForDefaultEntry.has(stateNodeToEnter)) {
      for (const stateNode of statesForDefaultEntry) {
        const initialActions = stateNode.initial!.actions;
        actions.push(...initialActions);
      }
    }
    if (stateNodeToEnter.type === 'final') {
      const parent = stateNodeToEnter.parent!;

      if (!parent.parent) {
        continue;
      }

      internalQueue.push(
        done(
          parent!.id,
          stateNodeToEnter.output
            ? mapContext(
                stateNodeToEnter.output,
                currentState.context,
                event,
                actorContext.self
              )
            : undefined
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
            internalQueue.push(done(grandparent.id));
          }
        }
      }
    }
  }
}

function computeEntrySet(
  transitions: Array<AnyTransitionDefinition>,
  historyValue: HistoryValue<any, any>,
  statesForDefaultEntry: Set<AnyStateNode>,
  statesToEnter: Set<AnyStateNode>
) {
  for (const t of transitions) {
    for (const s of t.target || []) {
      addDescendantStatesToEnter(
        s,
        historyValue,
        statesForDefaultEntry,
        statesToEnter
      );
    }
    const ancestor = getTransitionDomain(t, historyValue);
    const targetStates = getEffectiveTargetStates(t, historyValue);
    for (const s of targetStates) {
      addAncestorStatesToEnter(
        s,
        ancestor,
        statesToEnter,
        historyValue,
        statesForDefaultEntry
      );
    }
  }
}

function addDescendantStatesToEnter<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  historyValue: HistoryValue<any, any>,
  statesForDefaultEntry: Set<AnyStateNode>,
  statesToEnter: Set<AnyStateNode>
) {
  if (isHistoryNode(stateNode)) {
    if (historyValue[stateNode.id]) {
      const historyStateNodes = historyValue[stateNode.id];
      for (const s of historyStateNodes) {
        addDescendantStatesToEnter(
          s,
          historyValue,
          statesForDefaultEntry,
          statesToEnter
        );
      }
      for (const s of historyStateNodes) {
        addAncestorStatesToEnter(
          s,
          stateNode.parent!,
          statesToEnter,
          historyValue,
          statesForDefaultEntry
        );
        for (const stateForDefaultEntry of statesForDefaultEntry) {
          statesForDefaultEntry.add(stateForDefaultEntry);
        }
      }
    } else {
      const targets = resolveHistoryTarget<TContext, TEvent>(stateNode);
      for (const s of targets) {
        addDescendantStatesToEnter(
          s,
          historyValue,
          statesForDefaultEntry,
          statesToEnter
        );
      }
      for (const s of targets) {
        addAncestorStatesToEnter(
          s,
          stateNode,
          statesToEnter,
          historyValue,
          statesForDefaultEntry
        );
        for (const stateForDefaultEntry of statesForDefaultEntry) {
          statesForDefaultEntry.add(stateForDefaultEntry);
        }
      }
    }
  } else {
    statesToEnter.add(stateNode);
    if (stateNode.type === 'compound') {
      statesForDefaultEntry.add(stateNode);
      const initialStates = stateNode.initial.target;

      for (const initialState of initialStates) {
        addDescendantStatesToEnter(
          initialState,
          historyValue,
          statesForDefaultEntry,
          statesToEnter
        );
      }

      for (const initialState of initialStates) {
        addAncestorStatesToEnter(
          initialState,
          stateNode,
          statesToEnter,
          historyValue,
          statesForDefaultEntry
        );
      }
    } else {
      if (stateNode.type === 'parallel') {
        for (const child of getChildren(stateNode).filter(
          (sn) => !isHistoryNode(sn)
        )) {
          if (![...statesToEnter].some((s) => isDescendant(s, child))) {
            addDescendantStatesToEnter(
              child,
              historyValue,
              statesForDefaultEntry,
              statesToEnter
            );
          }
        }
      }
    }
  }
}

function addAncestorStatesToEnter(
  stateNode: AnyStateNode,
  toStateNode: AnyStateNode | null,
  statesToEnter: Set<AnyStateNode>,
  historyValue: HistoryValue<any, any>,
  statesForDefaultEntry: Set<AnyStateNode>
) {
  const properAncestors = getProperAncestors(stateNode, toStateNode);
  for (const anc of properAncestors) {
    statesToEnter.add(anc);
    if (anc.type === 'parallel') {
      for (const child of getChildren(anc).filter((sn) => !isHistoryNode(sn))) {
        if (![...statesToEnter].some((s) => isDescendant(s, child))) {
          addDescendantStatesToEnter(
            child,
            historyValue,
            statesForDefaultEntry,
            statesToEnter
          );
        }
      }
    }
  }
}

function exitStates(
  transitions: AnyTransitionDefinition[],
  mutConfiguration: Set<AnyStateNode>,
  historyValue: HistoryValue<any, any>,
  actions: Action<any, any, any>[]
) {
  const statesToExit = computeExitSet(
    transitions,
    mutConfiguration,
    historyValue
  );

  statesToExit.sort((a, b) => b.order - a.order);

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
      historyValue[historyNode.id] =
        Array.from(mutConfiguration).filter(predicate);
    }
  }

  for (const s of statesToExit) {
    actions.push(...s.exit, ...s.invoke.map((def) => stop(def.id)));
    mutConfiguration.delete(s);
  }
}

interface BuiltinAction {
  (): void;
  resolve: (
    actorContext: AnyActorContext,
    state: AnyState,
    actionArgs: ActionArgs<any, any>,
    action: unknown
  ) => [newState: AnyState, params: unknown, actions?: Action<any, any, any>[]];
  execute: (actorContext: AnyActorContext, params: unknown) => void;
}

export function resolveActionsAndContext<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  actions: Action<any, any, any>[],
  event: TEvent,
  currentState: State<TContext, TEvent, TODO, any>,
  actorCtx: AnyActorContext
): AnyState {
  const { machine } = currentState;
  // TODO: this `cloneState` is really just a hack to prevent infinite loops
  // we need to take another look at how internal queue is managed
  let intermediateState = cloneState(currentState, {
    _internalQueue: []
  });

  for (const action of actions) {
    const resolved =
      typeof action === 'function'
        ? action
        : machine.implementations.actions[
            typeof action === 'string' ? action : action.type
          ];

    if (!resolved) {
      continue;
    }

    const args = {
      context: intermediateState.context,
      event,
      self: actorCtx?.self,
      system: actorCtx?.system,
      // TODO: figure out story for `action` and inline actions
      // what those ones should receive?
      //
      // entry: ({ action }) => {}
      // exit: assign(({ action }) => {})
      action: typeof action === 'string' ? { type: action } : (action as any)
    };

    if (!('resolve' in resolved)) {
      if (actorCtx?.self.status === ActorStatus.Running) {
        resolved(args);
      } else {
        actorCtx?.defer(() => resolved(args));
      }
      continue;
    }

    const builtinAction = resolved as BuiltinAction;

    const [nextState, params, actions] = builtinAction.resolve(
      actorCtx,
      intermediateState,
      args,
      resolved // this holds all params
    );
    intermediateState = nextState;

    if ('execute' in resolved) {
      if (actorCtx?.self.status === ActorStatus.Running) {
        builtinAction.execute(actorCtx!, params);
      } else {
        actorCtx?.defer(builtinAction.execute.bind(null, actorCtx!, params));
      }
    }

    if (actions) {
      intermediateState = resolveActionsAndContext(
        actions,
        event,
        intermediateState,
        actorCtx
      );
    }
  }

  return intermediateState;
}

export function macrostep(
  state: AnyState,
  event: EventObject,
  actorCtx: AnyActorContext
): {
  state: typeof state;
  microstates: Array<typeof state>;
} {
  if (isDevelopment && event.type === WILDCARD) {
    throw new Error(`An event cannot have the wildcard type ('${WILDCARD}')`);
  }

  let nextState = state;
  const states: AnyState[] = [];

  // Handle stop event
  if (event.type === stopSignalType) {
    nextState = stopStep(event, nextState, actorCtx);
    states.push(nextState);

    return {
      state: nextState,
      microstates: states
    };
  }

  let nextEvent = event;

  // Assume the state is at rest (no raised events)
  // Determine the next state based on the next microstep
  if (nextEvent.type !== INIT_TYPE) {
    const transitions = selectTransitions(nextEvent, nextState);
    nextState = microstep(transitions, state, actorCtx, nextEvent, false);
    states.push(nextState);
  }

  while (nextState.status.status === 'active') {
    let enabledTransitions = selectEventlessTransitions(nextState, nextEvent);

    if (!enabledTransitions.length) {
      if (!nextState._internalQueue.length) {
        break;
      } else {
        nextEvent = nextState._internalQueue[0];
        const transitions = selectTransitions(nextEvent, nextState);
        nextState = microstep(
          transitions,
          nextState,
          actorCtx,
          nextEvent,
          false
        );
        nextState._internalQueue.shift();

        states.push(nextState);
      }
    } else {
      nextState = microstep(
        enabledTransitions,
        nextState,
        actorCtx,
        nextEvent,
        false
      );

      states.push(nextState);
    }
  }

  if (nextState.status.status === 'done') {
    // Perform the stop step to ensure that child actors are stopped
    stopStep(nextEvent, nextState, actorCtx);
  }

  return {
    state: nextState,
    microstates: states
  };
}

function stopStep(
  event: AnyEventObject,
  nextState: AnyState,
  actorCtx: AnyActorContext
) {
  const actions: Action<any, any, any>[] = [];

  for (const stateNode of nextState.configuration.sort(
    (a, b) => b.order - a.order
  )) {
    actions.push(...stateNode.exit);
  }

  for (const child of Object.values(nextState.children)) {
    actions.push(stop(child));
  }

  return resolveActionsAndContext(actions, event, nextState, actorCtx);
}

function selectTransitions(
  event: AnyEventObject,
  nextState: AnyState
): AnyTransitionDefinition[] {
  return nextState.machine.getTransitionData(nextState, event);
}

function selectEventlessTransitions(
  nextState: AnyState,
  event: AnyEventObject
): AnyTransitionDefinition[] {
  const enabledTransitionSet: Set<AnyTransitionDefinition> = new Set();
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
          evaluateGuard(transition.guard, nextState.context, event, nextState)
        ) {
          enabledTransitionSet.add(transition);
          break loop;
        }
      }
    }
  }

  return removeConflictingTransitions(
    Array.from(enabledTransitionSet),
    new Set(nextState.configuration),
    nextState.historyValue
  );
}

/**
 * Resolves a partial state value with its full representation in the state node's machine.
 *
 * @param stateValue The partial state value to resolve.
 */
export function resolveStateValue(
  rootNode: AnyStateNode,
  stateValue: StateValue
): StateValue {
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

  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }

  const aKeys = Object.keys(a as StateValueMap);
  const bKeys = Object.keys(b as StateValueMap);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => stateValuesEqual(a[key], b[key]))
  );
}

export function getInitialConfiguration(
  rootNode: AnyStateNode
): AnyStateNode[] {
  const configuration: AnyStateNode[] = [];
  const initialTransition = rootNode.initial;

  const statesToEnter = new Set<AnyStateNode>();
  const statesForDefaultEntry = new Set<AnyStateNode>([rootNode]);

  computeEntrySet(
    [initialTransition],
    {},
    statesForDefaultEntry,
    statesToEnter
  );

  for (const stateNodeToEnter of [...statesToEnter].sort(
    (a, b) => a.order - b.order
  )) {
    configuration.push(stateNodeToEnter);
  }

  return configuration;
}
