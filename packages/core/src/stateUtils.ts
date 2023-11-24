import isDevelopment from '#is-development';
import { MachineSnapshot, cloneMachineSnapshot } from './State.ts';
import type { StateNode } from './StateNode.ts';
import { raise } from './actions.ts';
import { createAfterEvent, createDoneStateEvent } from './eventUtils.ts';
import { cancel } from './actions/cancel.ts';
import { spawn } from './actions/spawn.ts';
import { stop } from './actions/stop.ts';
import {
  XSTATE_INIT,
  NULL_EVENT,
  STATE_DELIMITER,
  STATE_IDENTIFIER,
  XSTATE_STOP,
  WILDCARD
} from './constants.ts';
import { evaluateGuard } from './guards.ts';
import {
  ActionArgs,
  AnyEventObject,
  AnyHistoryValue,
  AnyMachineSnapshot,
  AnyStateNode,
  AnyTransitionDefinition,
  DelayExpr,
  DelayedTransitionDefinition,
  EventObject,
  HistoryValue,
  InitialTransitionConfig,
  InitialTransitionDefinition,
  MachineContext,
  StateValue,
  StateValueMap,
  TransitionDefinition,
  TODO,
  UnknownAction,
  ParameterizedObject,
  ActionFunction,
  AnyTransitionConfig,
  ProvidedActor,
  AnyActorScope
} from './types.ts';
import {
  resolveOutput,
  normalizeTarget,
  toArray,
  toStatePath,
  toTransitionConfigArray,
  isErrorActorEvent
} from './utils.ts';
import { ProcessingStatus } from './interpreter.ts';

type StateNodeIterable<
  TContext extends MachineContext,
  TE extends EventObject
> = Iterable<StateNode<TContext, TE>>;
type AnyStateNodeIterable = StateNodeIterable<any, any>;

type AdjList = Map<AnyStateNode, Array<AnyStateNode>>;

export const isAtomicStateNode = (stateNode: StateNode<any, any>) =>
  stateNode.type === 'atomic' || stateNode.type === 'final';

function getChildren<TContext extends MachineContext, TE extends EventObject>(
  stateNode: StateNode<TContext, TE>
): Array<StateNode<TContext, TE>> {
  return Object.values(stateNode.states).filter((sn) => sn.type !== 'history');
}

function getProperAncestors(
  stateNode: AnyStateNode,
  toStateNode: AnyStateNode | undefined
): Array<typeof stateNode> {
  const ancestors: Array<typeof stateNode> = [];

  if (toStateNode === stateNode) {
    return ancestors;
  }

  // add all ancestors
  let m = stateNode.parent;
  while (m && m !== toStateNode) {
    ancestors.push(m);
    m = m.parent;
  }

  return ancestors;
}

export function getAllStateNodes(
  stateNodes: Iterable<AnyStateNode>
): Set<AnyStateNode> {
  const nodeSet = new Set(stateNodes);

  const adjList = getAdjList(nodeSet);

  // add descendants
  for (const s of nodeSet) {
    // if previously active, add existing child nodes
    if (s.type === 'compound' && (!adjList.get(s) || !adjList.get(s)!.length)) {
      getInitialStateNodesWithTheirAncestors(s).forEach((sn) =>
        nodeSet.add(sn)
      );
    } else {
      if (s.type === 'parallel') {
        for (const child of getChildren(s)) {
          if (child.type === 'history') {
            continue;
          }

          if (!nodeSet.has(child)) {
            const initialStates = getInitialStateNodesWithTheirAncestors(child);
            for (const initialStateNode of initialStates) {
              nodeSet.add(initialStateNode);
            }
          }
        }
      }
    }
  }

  // add all ancestors
  for (const s of nodeSet) {
    let m = s.parent;

    while (m) {
      nodeSet.add(m);
      m = m.parent;
    }
  }

  return nodeSet;
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
>(stateNodes: StateNodeIterable<TContext, TE>): AdjList {
  const adjList: AdjList = new Map();

  for (const s of stateNodes) {
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
  stateNodes: AnyStateNodeIterable
): StateValue {
  const config = getAllStateNodes(stateNodes);
  return getValueFromAdj(rootNode, getAdjList(config));
}

export function isInFinalState(
  stateNodeSet: Set<AnyStateNode>,
  stateNode: AnyStateNode
): boolean {
  if (stateNode.type === 'compound') {
    return getChildren(stateNode).some(
      (s) => s.type === 'final' && stateNodeSet.has(s)
    );
  }
  if (stateNode.type === 'parallel') {
    return getChildren(stateNode).every((sn) =>
      isInFinalState(stateNodeSet, sn)
    );
  }

  return stateNode.type === 'final';
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
export function getDelayedTransitions(
  stateNode: AnyStateNode
): Array<DelayedTransitionDefinition<MachineContext, EventObject>> {
  const afterConfig = stateNode.config.after;
  if (!afterConfig) {
    return [];
  }

  const mutateEntryExit = (
    delay:
      | string
      | number
      | DelayExpr<
          MachineContext,
          EventObject,
          ParameterizedObject['params'] | undefined,
          EventObject
        >,
    i: number
  ) => {
    const delayRef =
      typeof delay === 'function' ? `${stateNode.id}:delay[${i}]` : delay;
    const afterEvent = createAfterEvent(delayRef, stateNode.id);
    const eventType = afterEvent.type;
    stateNode.entry.push(raise(afterEvent, { id: eventType, delay }));
    stateNode.exit.push(cancel(eventType));
    return eventType;
  };

  const delayedTransitions = Object.keys(afterConfig).flatMap((delay, i) => {
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
  transitionConfig: AnyTransitionConfig
): AnyTransitionDefinition {
  const normalizedTarget = normalizeTarget(transitionConfig.target);
  const reenter = transitionConfig.reenter ?? false;
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
    guard: transitionConfig.guard as never,
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
    const descriptor = `xstate.done.state.${stateNode.id}`;
    transitions.set(
      descriptor,
      toTransitionConfigArray(stateNode.config.onDone).map((t) =>
        formatTransition(stateNode, descriptor, t)
      )
    );
  }
  for (const invokeDef of stateNode.invoke) {
    if (invokeDef.onDone) {
      const descriptor = `xstate.done.actor.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onDone).map((t) =>
          formatTransition(stateNode, descriptor, t)
        )
      );
    }
    if (invokeDef.onError) {
      const descriptor = `xstate.error.actor.${invokeDef.id}`;
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
  _target:
    | string
    | undefined
    | InitialTransitionConfig<TContext, TEvent, TODO, TODO, TODO, TODO>
): InitialTransitionDefinition<TContext, TEvent> {
  const resolvedTarget =
    typeof _target === 'string'
      ? stateNode.states[_target]
      : _target
        ? stateNode.states[_target.target]
        : undefined;
  if (!resolvedTarget && _target) {
    throw new Error(
      `Initial state node "${_target}" not found on parent state node #${stateNode.id}`
    );
  }
  const transition: InitialTransitionDefinition<TContext, TEvent> = {
    source: stateNode,
    actions:
      !_target || typeof _target === 'string' ? [] : toArray(_target.actions),
    eventType: null as any,
    reenter: false,
    target: resolvedTarget ? [resolvedTarget] : [],
    toJSON: () => ({
      ...transition,
      source: `#${stateNode.id}`,
      target: resolvedTarget ? [`#${resolvedTarget.id}`] : []
    })
  };

  return transition;
}

export function resolveTarget(
  stateNode: AnyStateNode,
  targets: ReadonlyArray<string | AnyStateNode> | undefined
): ReadonlyArray<AnyStateNode> | undefined {
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

function resolveHistoryDefaultTransition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(stateNode: AnyStateNode & { type: 'history' }) {
  const normalizedTarget = normalizeTarget<TContext, TEvent>(
    stateNode.config.target
  );
  if (!normalizedTarget) {
    return stateNode.parent!.initial;
  }
  return {
    target: normalizedTarget.map((t) =>
      typeof t === 'string' ? getStateNodeByPath(stateNode.parent!, t) : t
    )
  };
}

function isHistoryNode(
  stateNode: AnyStateNode
): stateNode is AnyStateNode & { type: 'history' } {
  return stateNode.type === 'history';
}

export function getInitialStateNodesWithTheirAncestors(
  stateNode: AnyStateNode
) {
  const states = getInitialStateNodes(stateNode);
  for (const initialState of states) {
    for (const ancestor of getProperAncestors(initialState, stateNode)) {
      states.add(ancestor);
    }
  }
  return states;
}

export function getInitialStateNodes(stateNode: AnyStateNode) {
  const set = new Set<AnyStateNode>();

  function iter(descStateNode: AnyStateNode): void {
    if (set.has(descStateNode)) {
      return;
    }
    set.add(descStateNode);
    if (descStateNode.type === 'compound') {
      iter(descStateNode.initial.target[0]);
    } else if (descStateNode.type === 'parallel') {
      for (const child of getChildren(descStateNode)) {
        iter(child);
      }
    }
  }

  iter(stateNode);

  return set;
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
 * @param stateValue The state value or State instance
 */
export function getStateNodes<
  TContext extends MachineContext,
  TEvent extends EventObject
>(stateNode: AnyStateNode, stateValue: StateValue): Array<AnyStateNode> {
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
  state: MachineSnapshot<TContext, TEvent, any, any, any, any>,
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
  state: MachineSnapshot<TContext, TEvent, any, any, any, any>,
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
  state: MachineSnapshot<TContext, TEvent, any, any, any, any>,
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
  state: MachineSnapshot<TContext, TEvent, any, any, any, any>,
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
  stateNodeSet: Set<AnyStateNode>,
  historyValue: AnyHistoryValue
): Array<AnyTransitionDefinition> {
  const filteredTransitions = new Set<AnyTransitionDefinition>();

  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = new Set<AnyTransitionDefinition>();
    for (const t2 of filteredTransitions) {
      if (
        hasIntersection(
          computeExitSet([t1], stateNodeSet, historyValue),
          computeExitSet([t2], stateNodeSet, historyValue)
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

function findLeastCommonAncestor(
  stateNodes: Array<AnyStateNode>
): AnyStateNode | undefined {
  const [head, ...tail] = stateNodes;
  for (const ancestor of getProperAncestors(head, undefined)) {
    if (tail.every((sn) => isDescendant(sn, ancestor))) {
      return ancestor;
    }
  }
}

function getEffectiveTargetStates(
  transition: Pick<AnyTransitionDefinition, 'target'>,
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
          resolveHistoryDefaultTransition(targetNode),
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
): AnyStateNode | undefined {
  const targetStates = getEffectiveTargetStates(transition, historyValue);

  if (!targetStates) {
    return;
  }

  if (
    !transition.reenter &&
    targetStates.every(
      (target) =>
        target === transition.source || isDescendant(target, transition.source)
    )
  ) {
    return transition.source;
  }

  const lca = findLeastCommonAncestor(targetStates.concat(transition.source));

  if (lca) {
    return lca;
  }

  // at this point we know that it's a root transition since LCA couldn't be found
  if (transition.reenter) {
    return;
  }

  return transition.source.machine.root;
}

function computeExitSet(
  transitions: AnyTransitionDefinition[],
  stateNodeSet: Set<AnyStateNode>,
  historyValue: AnyHistoryValue
): Array<AnyStateNode> {
  const statesToExit = new Set<AnyStateNode>();

  for (const t of transitions) {
    if (t.target?.length) {
      const domain = getTransitionDomain(t, historyValue);

      if (t.reenter && t.source === domain) {
        statesToExit.add(domain);
      }

      for (const stateNode of stateNodeSet) {
        if (isDescendant(stateNode, domain!)) {
          statesToExit.add(stateNode);
        }
      }
    }
  }

  return [...statesToExit];
}

function areStateNodeCollectionsEqual(
  prevStateNodes: StateNode<any, any>[],
  nextStateNodeSet: Set<StateNode<any, any>>
) {
  if (prevStateNodes.length !== nextStateNodeSet.size) {
    return false;
  }
  for (const node of prevStateNodes) {
    if (!nextStateNodeSet.has(node)) {
      return false;
    }
  }
  return true;
}

/**
 * https://www.w3.org/TR/scxml/#microstepProcedure
 */
export function microstep<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  transitions: Array<AnyTransitionDefinition>,
  currentState: AnyMachineSnapshot,
  actorScope: AnyActorScope,
  event: AnyEventObject,
  isInitial: boolean,
  internalQueue: Array<AnyEventObject>
): AnyMachineSnapshot {
  if (!transitions.length) {
    return currentState;
  }
  const mutStateNodeSet = new Set(currentState._nodes);
  let historyValue = currentState.historyValue;

  const filteredTransitions = removeConflictingTransitions(
    transitions,
    mutStateNodeSet,
    historyValue
  );

  let nextState = currentState;

  // Exit states
  if (!isInitial) {
    [nextState, historyValue] = exitStates(
      nextState,
      event,
      actorScope,
      filteredTransitions,
      mutStateNodeSet,
      historyValue,
      internalQueue
    );
  }

  // Execute transition content
  nextState = resolveActionsAndContext(
    nextState,
    event,
    actorScope,
    filteredTransitions.flatMap((t) => t.actions),
    internalQueue
  );

  // Enter states
  nextState = enterStates(
    nextState,
    event,
    actorScope,
    filteredTransitions,
    mutStateNodeSet,
    internalQueue,
    historyValue,
    isInitial
  );

  const nextStateNodes = [...mutStateNodeSet];

  if (nextState.status === 'done') {
    nextState = resolveActionsAndContext(
      nextState,
      event,
      actorScope,
      nextStateNodes
        .sort((a, b) => b.order - a.order)
        .flatMap((state) => state.exit),
      internalQueue
    );
  }

  try {
    if (
      historyValue === currentState.historyValue &&
      areStateNodeCollectionsEqual(currentState._nodes, mutStateNodeSet)
    ) {
      return nextState;
    }
    return cloneMachineSnapshot(nextState, {
      _nodes: nextStateNodes,
      historyValue
    });
  } catch (e) {
    // TODO: Refactor this once proper error handling is implemented.
    // See https://github.com/statelyai/rfcs/pull/4
    throw e;
  }
}

function getMachineOutput(
  state: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  rootNode: AnyStateNode,
  rootCompletionNode: AnyStateNode
) {
  if (!rootNode.output) {
    return;
  }
  const doneStateEvent = createDoneStateEvent(
    rootCompletionNode.id,
    rootCompletionNode.output && rootCompletionNode.parent
      ? resolveOutput(
          rootCompletionNode.output,
          state.context,
          event,
          actorScope.self
        )
      : undefined
  );
  return resolveOutput(
    rootNode.output,
    state.context,
    doneStateEvent,
    actorScope.self
  );
}

function enterStates(
  currentState: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  filteredTransitions: AnyTransitionDefinition[],
  mutStateNodeSet: Set<AnyStateNode>,
  internalQueue: AnyEventObject[],
  historyValue: HistoryValue<any, any>,
  isInitial: boolean
) {
  let nextState = currentState;
  const statesToEnter = new Set<AnyStateNode>();
  // those are states that were directly targeted or indirectly targeted by the explicit target
  // in other words, those are states for which initial actions should be executed
  // when we target `#deep_child` initial actions of its ancestors shouldn't be executed
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

  const completedNodes = new Set();

  for (const stateNodeToEnter of [...statesToEnter].sort(
    (a, b) => a.order - b.order
  )) {
    mutStateNodeSet.add(stateNodeToEnter);
    const actions: UnknownAction[] = [];

    // Add entry actions
    actions.push(...stateNodeToEnter.entry);

    for (const invokeDef of stateNodeToEnter.invoke) {
      actions.push(
        spawn(invokeDef.src, {
          ...invokeDef,
          syncSnapshot: !!invokeDef.onSnapshot
        })
      );
    }

    if (statesForDefaultEntry.has(stateNodeToEnter)) {
      const initialActions = stateNodeToEnter.initial!.actions;
      actions.push(...initialActions);
    }

    nextState = resolveActionsAndContext(
      nextState,
      event,
      actorScope,
      actions,
      internalQueue,
      stateNodeToEnter.invoke.map((invokeDef) => invokeDef.id)
    );

    if (stateNodeToEnter.type === 'final') {
      const parent = stateNodeToEnter.parent;

      let ancestorMarker =
        parent?.type === 'parallel' ? parent : parent?.parent;
      let rootCompletionNode = ancestorMarker || stateNodeToEnter;

      if (parent?.type === 'compound') {
        internalQueue.push(
          createDoneStateEvent(
            parent!.id,
            stateNodeToEnter.output
              ? resolveOutput(
                  stateNodeToEnter.output,
                  nextState.context,
                  event,
                  actorScope.self
                )
              : undefined
          )
        );
      }
      while (
        ancestorMarker?.type === 'parallel' &&
        !completedNodes.has(ancestorMarker) &&
        isInFinalState(mutStateNodeSet, ancestorMarker)
      ) {
        completedNodes.add(ancestorMarker);
        internalQueue.push(createDoneStateEvent(ancestorMarker.id));
        rootCompletionNode = ancestorMarker;
        ancestorMarker = ancestorMarker.parent;
      }
      if (ancestorMarker) {
        continue;
      }

      nextState = cloneMachineSnapshot(nextState, {
        status: 'done',
        output: getMachineOutput(
          nextState,
          event,
          actorScope,
          nextState.machine.root,
          rootCompletionNode
        )
      });
    }
  }

  return nextState;
}

function computeEntrySet(
  transitions: Array<AnyTransitionDefinition>,
  historyValue: HistoryValue<any, any>,
  statesForDefaultEntry: Set<AnyStateNode>,
  statesToEnter: Set<AnyStateNode>
) {
  for (const t of transitions) {
    const domain = getTransitionDomain(t, historyValue);

    for (const s of t.target || []) {
      if (
        !isHistoryNode(s) &&
        // if the target is different than the source then it will *definitely* be entered
        (t.source !== s ||
          // we know that the domain can't lie within the source
          // if it's different than the source then it's outside of it and it means that the target has to be entered as well
          t.source !== domain ||
          // reentering transitions always enter the target, even if it's the source itself
          t.reenter)
      ) {
        statesToEnter.add(s);
        statesForDefaultEntry.add(s);
      }
      addDescendantStatesToEnter(
        s,
        historyValue,
        statesForDefaultEntry,
        statesToEnter
      );
    }
    const targetStates = getEffectiveTargetStates(t, historyValue);
    for (const s of targetStates) {
      const ancestors = getProperAncestors(s, domain);
      if (domain?.type === 'parallel') {
        ancestors.push(domain!);
      }
      addAncestorStatesToEnter(
        statesToEnter,
        historyValue,
        statesForDefaultEntry,
        ancestors,
        !t.source.parent && t.reenter ? undefined : domain
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
        statesToEnter.add(s);

        addDescendantStatesToEnter(
          s,
          historyValue,
          statesForDefaultEntry,
          statesToEnter
        );
      }
      for (const s of historyStateNodes) {
        addProperAncestorStatesToEnter(
          s,
          stateNode.parent!,
          statesToEnter,
          historyValue,
          statesForDefaultEntry
        );
      }
    } else {
      const historyDefaultTransition = resolveHistoryDefaultTransition<
        TContext,
        TEvent
      >(stateNode);
      for (const s of historyDefaultTransition.target) {
        statesToEnter.add(s);

        if (historyDefaultTransition === stateNode.parent?.initial) {
          statesForDefaultEntry.add(stateNode.parent);
        }

        addDescendantStatesToEnter(
          s,
          historyValue,
          statesForDefaultEntry,
          statesToEnter
        );
      }

      for (const s of historyDefaultTransition.target) {
        addProperAncestorStatesToEnter(
          s,
          stateNode,
          statesToEnter,
          historyValue,
          statesForDefaultEntry
        );
      }
    }
  } else {
    if (stateNode.type === 'compound') {
      const [initialState] = stateNode.initial.target;

      if (!isHistoryNode(initialState)) {
        statesToEnter.add(initialState);
        statesForDefaultEntry.add(initialState);
      }
      addDescendantStatesToEnter(
        initialState,
        historyValue,
        statesForDefaultEntry,
        statesToEnter
      );

      addProperAncestorStatesToEnter(
        initialState,
        stateNode,
        statesToEnter,
        historyValue,
        statesForDefaultEntry
      );
    } else {
      if (stateNode.type === 'parallel') {
        for (const child of getChildren(stateNode).filter(
          (sn) => !isHistoryNode(sn)
        )) {
          if (![...statesToEnter].some((s) => isDescendant(s, child))) {
            if (!isHistoryNode(child)) {
              statesToEnter.add(child);
              statesForDefaultEntry.add(child);
            }
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
  statesToEnter: Set<AnyStateNode>,
  historyValue: HistoryValue<any, any>,
  statesForDefaultEntry: Set<AnyStateNode>,
  ancestors: AnyStateNode[],
  reentrancyDomain?: AnyStateNode
) {
  for (const anc of ancestors) {
    if (!reentrancyDomain || isDescendant(anc, reentrancyDomain)) {
      statesToEnter.add(anc);
    }
    if (anc.type === 'parallel') {
      for (const child of getChildren(anc).filter((sn) => !isHistoryNode(sn))) {
        if (![...statesToEnter].some((s) => isDescendant(s, child))) {
          statesToEnter.add(child);
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

function addProperAncestorStatesToEnter(
  stateNode: AnyStateNode,
  toStateNode: AnyStateNode | undefined,
  statesToEnter: Set<AnyStateNode>,
  historyValue: HistoryValue<any, any>,
  statesForDefaultEntry: Set<AnyStateNode>
) {
  addAncestorStatesToEnter(
    statesToEnter,
    historyValue,
    statesForDefaultEntry,
    getProperAncestors(stateNode, toStateNode)
  );
}

function exitStates(
  currentState: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  transitions: AnyTransitionDefinition[],
  mutStateNodeSet: Set<AnyStateNode>,
  historyValue: HistoryValue<any, any>,
  internalQueue: AnyEventObject[]
) {
  let nextState = currentState;
  const statesToExit = computeExitSet(
    transitions,
    mutStateNodeSet,
    historyValue
  );

  statesToExit.sort((a, b) => b.order - a.order);

  let changedHistory: typeof historyValue | undefined;

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
      changedHistory ??= { ...historyValue };
      changedHistory[historyNode.id] =
        Array.from(mutStateNodeSet).filter(predicate);
    }
  }

  for (const s of statesToExit) {
    nextState = resolveActionsAndContext(
      nextState,
      event,
      actorScope,
      [...s.exit, ...s.invoke.map((def) => stop(def.id))],
      internalQueue
    );
    mutStateNodeSet.delete(s);
  }
  return [nextState, changedHistory || historyValue] as const;
}

interface BuiltinAction {
  (): void;
  resolve: (
    actorScope: AnyActorScope,
    state: AnyMachineSnapshot,
    actionArgs: ActionArgs<any, any, any>,
    actionParams: ParameterizedObject['params'] | undefined,
    action: unknown,
    extra: unknown
  ) => [
    newState: AnyMachineSnapshot,
    params: unknown,
    actions?: UnknownAction[]
  ];
  retryResolve: (
    actorScope: AnyActorScope,
    state: AnyMachineSnapshot,
    params: unknown
  ) => void;
  execute: (actorScope: AnyActorScope, params: unknown) => void;
}

function resolveActionsAndContextWorker(
  currentState: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  actions: UnknownAction[],
  extra: {
    internalQueue: AnyEventObject[];
    deferredActorIds: string[] | undefined;
  },
  retries: (readonly [BuiltinAction, unknown])[] | undefined
): AnyMachineSnapshot {
  const { machine } = currentState;
  let intermediateState = currentState;

  for (const action of actions) {
    const isInline = typeof action === 'function';
    const resolvedAction = isInline
      ? action
      : // the existing type of `.actions` assumes non-nullable `TExpressionAction`
        // it's fine to cast this here to get a common type and lack of errors in the rest of the code
        // our logic below makes sure that we call those 2 "variants" correctly
        (
          machine.implementations.actions as Record<
            string,
            ActionFunction<
              MachineContext,
              EventObject,
              EventObject,
              ParameterizedObject['params'] | undefined,
              ProvidedActor,
              ParameterizedObject,
              ParameterizedObject,
              string
            >
          >
        )[typeof action === 'string' ? action : action.type];

    if (!resolvedAction) {
      continue;
    }

    const actionArgs = {
      context: intermediateState.context,
      event,
      self: actorScope?.self,
      system: actorScope?.system
    };

    const actionParams =
      isInline || typeof action === 'string'
        ? undefined
        : 'params' in action
          ? typeof action.params === 'function'
            ? action.params({ context: intermediateState.context, event })
            : action.params
          : undefined;

    if (!('resolve' in resolvedAction)) {
      if (actorScope?.self._processingStatus === ProcessingStatus.Running) {
        resolvedAction(actionArgs, actionParams);
      } else {
        actorScope?.defer(() => {
          resolvedAction(actionArgs, actionParams);
        });
      }
      continue;
    }

    const builtinAction = resolvedAction as BuiltinAction;

    const [nextState, params, actions] = builtinAction.resolve(
      actorScope,
      intermediateState,
      actionArgs,
      actionParams,
      resolvedAction, // this holds all params
      extra
    );
    intermediateState = nextState;

    if ('retryResolve' in builtinAction) {
      retries?.push([builtinAction, params]);
    }

    if ('execute' in builtinAction) {
      if (actorScope?.self._processingStatus === ProcessingStatus.Running) {
        builtinAction.execute(actorScope!, params);
      } else {
        actorScope?.defer(
          builtinAction.execute.bind(null, actorScope!, params)
        );
      }
    }

    if (actions) {
      intermediateState = resolveActionsAndContextWorker(
        intermediateState,
        event,
        actorScope,
        actions,
        extra,
        retries
      );
    }
  }

  return intermediateState;
}

export function resolveActionsAndContext(
  currentState: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  actions: UnknownAction[],
  internalQueue: AnyEventObject[],
  deferredActorIds?: string[]
): AnyMachineSnapshot {
  const retries: (readonly [BuiltinAction, unknown])[] | undefined =
    deferredActorIds ? [] : undefined;
  const nextState = resolveActionsAndContextWorker(
    currentState,
    event,
    actorScope,
    actions,
    { internalQueue, deferredActorIds },
    retries
  );
  retries?.forEach(([builtinAction, params]) => {
    builtinAction.retryResolve(actorScope, nextState, params);
  });
  return nextState;
}

export function macrostep(
  state: AnyMachineSnapshot,
  event: EventObject,
  actorScope: AnyActorScope,
  internalQueue: AnyEventObject[] = []
): {
  state: typeof state;
  microstates: Array<typeof state>;
} {
  if (isDevelopment && event.type === WILDCARD) {
    throw new Error(`An event cannot have the wildcard type ('${WILDCARD}')`);
  }

  let nextState = state;
  const states: AnyMachineSnapshot[] = [];

  // Handle stop event
  if (event.type === XSTATE_STOP) {
    nextState = cloneMachineSnapshot(
      stopChildren(nextState, event, actorScope),
      {
        status: 'stopped'
      }
    );
    states.push(nextState);

    return {
      state: nextState,
      microstates: states
    };
  }

  let nextEvent = event;

  // Assume the state is at rest (no raised events)
  // Determine the next state based on the next microstep
  if (nextEvent.type !== XSTATE_INIT) {
    const currentEvent = nextEvent;
    const isErr = isErrorActorEvent(currentEvent);

    const transitions = selectTransitions(currentEvent, nextState);

    if (isErr && !transitions.length) {
      // TODO: we should likely only allow transitions selected by very explicit descriptors
      // `*` shouldn't be matched, likely `xstate.error.*` shouldnt be either
      // what about `xstate.error.actor.*`? what about `xstate.error.actor.todo.*`?
      nextState = cloneMachineSnapshot<typeof state>(state, {
        status: 'error',
        error: currentEvent.data
      });
      states.push(nextState);
      return {
        state: nextState,
        microstates: states
      };
    }
    nextState = microstep(
      transitions,
      state,
      actorScope,
      nextEvent,
      false,
      internalQueue
    );
    states.push(nextState);
  }

  let shouldSelectEventlessTransitions = true;

  while (nextState.status === 'active') {
    let enabledTransitions: AnyTransitionDefinition[] =
      shouldSelectEventlessTransitions
        ? selectEventlessTransitions(nextState, nextEvent)
        : [];

    // eventless transitions should always be selected after selecting *regular* transitions
    // by assigning `undefined` to `previousState` we ensure that `shouldSelectEventlessTransitions` gets always computed to true in such a case
    const previousState = enabledTransitions.length ? nextState : undefined;

    if (!enabledTransitions.length) {
      if (!internalQueue.length) {
        break;
      }
      nextEvent = internalQueue.shift()!;
      enabledTransitions = selectTransitions(nextEvent, nextState);
    }

    nextState = microstep(
      enabledTransitions,
      nextState,
      actorScope,
      nextEvent,
      false,
      internalQueue
    );
    shouldSelectEventlessTransitions = nextState !== previousState;
    states.push(nextState);
  }

  if (nextState.status !== 'active') {
    stopChildren(nextState, nextEvent, actorScope);
  }

  return {
    state: nextState,
    microstates: states
  };
}

function stopChildren(
  nextState: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
) {
  return resolveActionsAndContext(
    nextState,
    event,
    actorScope,
    Object.values(nextState.children).map((child: any) => stop(child)),
    []
  );
}

function selectTransitions(
  event: AnyEventObject,
  nextState: AnyMachineSnapshot
): AnyTransitionDefinition[] {
  return nextState.machine.getTransitionData(nextState as any, event);
}

function selectEventlessTransitions(
  nextState: AnyMachineSnapshot,
  event: AnyEventObject
): AnyTransitionDefinition[] {
  const enabledTransitionSet: Set<AnyTransitionDefinition> = new Set();
  const atomicStates = nextState._nodes.filter(isAtomicStateNode);

  for (const stateNode of atomicStates) {
    loop: for (const s of [stateNode].concat(
      getProperAncestors(stateNode, undefined)
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
    new Set(nextState._nodes),
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
  const allStateNodes = getAllStateNodes(getStateNodes(rootNode, stateValue));
  return getStateValue(rootNode, [...allStateNodes]);
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
