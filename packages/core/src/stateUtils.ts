import isDevelopment from '#is-development';
import { MachineSnapshot, cloneMachineSnapshot } from './State.ts';
import type { StateNode } from './StateNode.ts';
import { assign, raise, sendTo } from './actions.ts';
import { createAfterEvent, createDoneStateEvent } from './eventUtils.ts';
import { cancel } from './actions/cancel.ts';
import { stopChild } from './actions/stopChild.ts';
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
  AnyTransitionConfig,
  AnyActorScope,
  ActionExecutor,
  AnyStateMachine,
  EnqueueObject,
  Action2,
  AnyActorRef
} from './types.ts';
import {
  resolveOutput,
  normalizeTarget,
  toArray,
  toStatePath,
  toTransitionConfigArray,
  isErrorActorEvent,
  resolveReferencedActor
} from './utils.ts';
import { createActor } from './createActor.ts';

type StateNodeIterable<
  TContext extends MachineContext,
  TE extends EventObject
> = Iterable<StateNode<TContext, TE>>;
type AnyStateNodeIterable = StateNodeIterable<any, any>;

type AdjList = Map<AnyStateNode, Array<AnyStateNode>>;

const isAtomicStateNode = (stateNode: StateNode<any, any>) =>
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

function getAdjList<TContext extends MachineContext, TE extends EventObject>(
  stateNodes: StateNodeIterable<TContext, TE>
): AdjList {
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
      .filter((eventDescriptor) => {
        // check if transition is a wildcard transition,
        // which matches any non-transient events
        if (eventDescriptor === WILDCARD) {
          return true;
        }

        if (!eventDescriptor.endsWith('.*')) {
          return false;
        }

        if (isDevelopment && /.*\*.+/.test(eventDescriptor)) {
          console.warn(
            `Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "${eventDescriptor}" event.`
          );
        }

        const partialEventTokens = eventDescriptor.split('.');
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
                `Infix wildcards in transition events are not allowed. Check the "${eventDescriptor}" transition.`
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

/** All delayed transitions from the config. */
export function getDelayedTransitions(
  stateNode: AnyStateNode
): Array<DelayedTransitionDefinition<MachineContext, EventObject>> {
  const afterConfig = stateNode.config.after;
  if (!afterConfig) {
    return [];
  }

  const mutateEntryExit = (delay: string | number) => {
    const afterEvent = createAfterEvent(delay, stateNode.id);
    const eventType = afterEvent.type;

    stateNode.entry.push(
      raise(afterEvent, {
        id: eventType,
        delay
      })
    );
    const oldEntry = stateNode.entry2;
    stateNode.entry2 = (x, enq) => {
      enq.raise(afterEvent, {
        id: eventType,
        delay
      });
      return oldEntry?.(x, enq);
    };
    stateNode.exit.push(cancel(eventType));
    return eventType;
  };

  const delayedTransitions = Object.keys(afterConfig).flatMap((delay) => {
    const configTransition = afterConfig[delay];
    const resolvedTransition =
      typeof configTransition === 'string'
        ? { target: configTransition }
        : typeof configTransition === 'function'
          ? { fn: configTransition }
          : configTransition;
    const resolvedDelay = Number.isNaN(+delay) ? delay : +delay;
    const eventType = mutateEntryExit(resolvedDelay);
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

export function formatTransition(
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

function resolveInitialTarget(
  stateNode: AnyStateNode,
  targets: ReadonlyArray<string> | undefined
): ReadonlyArray<AnyStateNode> | undefined {
  return targets?.map((target) => {
    return stateNode.states?.[target];
  });
}

function resolveTarget(
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
    ),
    source: stateNode
  };
}

function isHistoryNode(
  stateNode: AnyStateNode
): stateNode is AnyStateNode & { type: 'history' } {
  return stateNode.type === 'history';
}

function getInitialStateNodesWithTheirAncestors(stateNode: AnyStateNode) {
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
/** Returns the child state node from its relative `stateKey`, or throws. */
function getStateNode(stateNode: AnyStateNode, stateKey: string): AnyStateNode {
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
    } catch {
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
export function getStateNodes(
  stateNode: AnyStateNode,
  stateValue: StateValue
): Array<AnyStateNode> {
  if (typeof stateValue === 'string') {
    const childStateNode = stateNode.states[stateValue];
    if (!childStateNode) {
      throw new Error(
        `State '${stateValue}' does not exist on '${stateNode.id}'`
      );
    }
    return [stateNode, childStateNode];
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
        stateValue[subStateKey]!
      );

      return allSubStateNodes.concat(subStateNodes);
    }, [] as Array<AnyStateNode>)
  );
}

function transitionAtomicNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  stateValue: string,
  snapshot: MachineSnapshot<
    TContext,
    TEvent,
    any,
    any,
    any,
    any,
    any, // TMeta
    any // TStateSchema
  >,
  event: TEvent,
  self: AnyActorRef
): Array<TransitionDefinition<TContext, TEvent>> | undefined {
  const childStateNode = getStateNode(stateNode, stateValue);
  const next = childStateNode.next(snapshot, event, self);

  if (!next || !next.length) {
    return stateNode.next(snapshot, event, self);
  }

  return next;
}

function transitionCompoundNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  stateValue: StateValueMap,
  snapshot: MachineSnapshot<
    TContext,
    TEvent,
    any,
    any,
    any,
    any,
    any, // TMeta
    any // TStateSchema
  >,
  event: TEvent,
  self: AnyActorRef
): Array<TransitionDefinition<TContext, TEvent>> | undefined {
  const subStateKeys = Object.keys(stateValue);

  const childStateNode = getStateNode(stateNode, subStateKeys[0]);
  const next = transitionNode(
    childStateNode,
    stateValue[subStateKeys[0]]!,
    snapshot,
    event,
    self
  );

  if (!next || !next.length) {
    return stateNode.next(snapshot, event, self);
  }

  return next;
}

function transitionParallelNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  stateValue: StateValueMap,
  snapshot: MachineSnapshot<
    TContext,
    TEvent,
    any,
    any,
    any,
    any,
    any, // TMeta
    any // TStateSchema
  >,
  event: TEvent,
  self: AnyActorRef
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
      snapshot,
      event,
      self
    );
    if (innerTransitions) {
      allInnerTransitions.push(...innerTransitions);
    }
  }
  if (!allInnerTransitions.length) {
    return stateNode.next(snapshot, event, self);
  }

  return allInnerTransitions;
}

export function transitionNode<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  stateValue: StateValue,
  snapshot: MachineSnapshot<
    TContext,
    TEvent,
    any,
    any,
    any,
    any,
    any,
    any // TStateSchema
  >,
  event: TEvent,
  self: AnyActorRef
): Array<TransitionDefinition<TContext, TEvent>> | undefined {
  // leaf node
  if (typeof stateValue === 'string') {
    return transitionAtomicNode(stateNode, stateValue, snapshot, event, self);
  }

  // compound node
  if (Object.keys(stateValue).length === 1) {
    return transitionCompoundNode(stateNode, stateValue, snapshot, event, self);
  }

  // parallel node
  return transitionParallelNode(stateNode, stateValue, snapshot, event, self);
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

function removeConflictingTransitions(
  enabledTransitions: Array<AnyTransitionDefinition>,
  stateNodeSet: Set<AnyStateNode>,
  historyValue: AnyHistoryValue,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
): Array<AnyTransitionDefinition> {
  const filteredTransitions = new Set<AnyTransitionDefinition>();

  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = new Set<AnyTransitionDefinition>();
    for (const t2 of filteredTransitions) {
      if (
        hasIntersection(
          computeExitSet(
            [t1],
            stateNodeSet,
            historyValue,
            snapshot,
            event,
            self,
            actorScope
          ),
          computeExitSet(
            [t2],
            stateNodeSet,
            historyValue,
            snapshot,
            event,
            self,
            actorScope
          )
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
  transition: Pick<AnyTransitionDefinition, 'target' | 'source'>,
  historyValue: AnyHistoryValue,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
): Array<AnyStateNode> {
  const { targets } = getTransitionResult(
    transition,
    snapshot,
    event,
    self,
    actorScope
  );
  if (!targets) {
    return [];
  }

  const targetSet = new Set<AnyStateNode>();

  for (const targetNode of targets) {
    if (isHistoryNode(targetNode)) {
      if (historyValue[targetNode.id]) {
        for (const node of historyValue[targetNode.id]) {
          targetSet.add(node);
        }
      } else {
        for (const node of getEffectiveTargetStates(
          resolveHistoryDefaultTransition(targetNode),
          historyValue,
          snapshot,
          event,
          self,
          actorScope
        )) {
          targetSet.add(node);
        }
      }
    } else {
      targetSet.add(targetNode);
    }
  }

  return [...targetSet];
}

function getTransitionDomain(
  transition: AnyTransitionDefinition,
  historyValue: AnyHistoryValue,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
): AnyStateNode | undefined {
  const targetStates = getEffectiveTargetStates(
    transition,
    historyValue,
    snapshot,
    event,
    self,
    actorScope
  );

  if (!targetStates) {
    return;
  }

  const { reenter } = getTransitionResult(
    transition,
    snapshot,
    event,
    self,
    actorScope
  );

  if (
    !reenter &&
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
  if (reenter) {
    return;
  }

  return transition.source.machine.root;
}

function computeExitSet(
  transitions: Array<AnyTransitionDefinition>,
  stateNodeSet: Set<AnyStateNode>,
  historyValue: AnyHistoryValue,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
): Array<AnyStateNode> {
  const statesToExit = new Set<AnyStateNode>();

  for (const t of transitions) {
    const { targets } = getTransitionResult(
      t,
      snapshot,
      event,
      self,
      actorScope
    );

    if (targets?.length) {
      const domain = getTransitionDomain(
        t,
        historyValue,
        snapshot,
        event,
        self,
        actorScope
      );

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
  prevStateNodes: StateNode[],
  nextStateNodeSet: Set<StateNode>
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

/** https://www.w3.org/TR/scxml/#microstepProcedure */
export function microstep(
  transitions: Array<AnyTransitionDefinition>,
  currentSnapshot: AnyMachineSnapshot,
  actorScope: AnyActorScope,
  event: AnyEventObject,
  isInitial: boolean,
  internalQueue: Array<AnyEventObject>
): AnyMachineSnapshot {
  if (!transitions.length) {
    return currentSnapshot;
  }
  const mutStateNodeSet = new Set(currentSnapshot._nodes);
  let historyValue = currentSnapshot.historyValue;

  const filteredTransitions = removeConflictingTransitions(
    transitions,
    mutStateNodeSet,
    historyValue,
    currentSnapshot,
    event,
    actorScope.self,
    actorScope
  );

  let nextState = currentSnapshot;

  // Exit states
  if (!isInitial) {
    [nextState, historyValue] = exitStates(
      nextState,
      event,
      actorScope,
      filteredTransitions,
      mutStateNodeSet,
      historyValue,
      internalQueue,
      actorScope.actionExecutor
    );
  }

  currentSnapshot.random = Math.random();

  const { context, actions } = filteredTransitions
    .flatMap((t) =>
      getTransitionResult(
        t,
        currentSnapshot,
        event,
        actorScope.self,
        actorScope
      )
    )
    .reduce(
      (acc, res) => {
        if (res.context) {
          acc.context = res.context;
        }
        acc.actions = [...acc.actions, ...res.actions];
        return acc;
      },
      { context: nextState.context, actions: [] as UnknownAction[] }
    );
  // Execute transition content
  nextState = resolveActionsAndContext(
    nextState,
    event,
    actorScope,
    actions,
    internalQueue,
    undefined
  );
  if (context && context !== currentSnapshot.context) {
    nextState = cloneMachineSnapshot(nextState, { context });
  }

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
    const exitActions = nextStateNodes
      .sort((a, b) => b.order - a.order)
      .flatMap((stateNode) => {
        if (stateNode.exit2) {
          const actions = getActionsFromAction2(stateNode.exit2, {
            context: nextState.context,
            event,
            self: actorScope.self,
            parent: actorScope.self._parent,
            children: nextState.children,
            actorScope,
            machine: currentSnapshot.machine
          });
          return [...stateNode.exit, ...actions];
        }
        return stateNode.exit;
      });
    nextState = resolveActionsAndContext(
      nextState,
      event,
      actorScope,
      exitActions,
      internalQueue,
      undefined
    );
  }

  // eslint-disable-next-line no-useless-catch
  try {
    if (
      historyValue === currentSnapshot.historyValue &&
      areStateNodeCollectionsEqual(currentSnapshot._nodes, mutStateNodeSet)
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
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  rootNode: AnyStateNode,
  rootCompletionNode: AnyStateNode
) {
  if (rootNode.output === undefined) {
    return;
  }
  const doneStateEvent = createDoneStateEvent(
    rootCompletionNode.id,
    rootCompletionNode.output !== undefined && rootCompletionNode.parent
      ? resolveOutput(
          rootCompletionNode.output,
          snapshot.context,
          event,
          actorScope.self
        )
      : undefined
  );
  return resolveOutput(
    rootNode.output,
    snapshot.context,
    doneStateEvent,
    actorScope.self
  );
}

function enterStates(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  filteredTransitions: AnyTransitionDefinition[],
  mutStateNodeSet: Set<AnyStateNode>,
  internalQueue: AnyEventObject[],
  historyValue: HistoryValue<any, any>,
  isInitial: boolean
) {
  let nextSnapshot = currentSnapshot;
  const statesToEnter = new Set<AnyStateNode>();
  // those are states that were directly targeted or indirectly targeted by the explicit target
  // in other words, those are states for which initial actions should be executed
  // when we target `#deep_child` initial actions of its ancestors shouldn't be executed
  const statesForDefaultEntry = new Set<AnyStateNode>();
  computeEntrySet(
    filteredTransitions,
    historyValue,
    statesForDefaultEntry,
    statesToEnter,
    currentSnapshot,
    event,
    actorScope.self,
    actorScope
  );

  // In the initial state, the root state node is "entered".
  if (isInitial) {
    statesForDefaultEntry.add(currentSnapshot.machine.root);
  }

  const completedNodes = new Set();

  const children = { ...currentSnapshot.children };
  let invoked = false;
  for (const stateNodeToEnter of [...statesToEnter].sort(
    (a, b) => a.order - b.order
  )) {
    mutStateNodeSet.add(stateNodeToEnter);
    const actions: UnknownAction[] = [];

    // Add entry actions
    if (!stateNodeToEnter.entry2) {
      actions.push(...stateNodeToEnter.entry);
    }

    for (const invokeDef of stateNodeToEnter.invoke) {
      invoked = true;
      let logic = resolveReferencedActor(
        currentSnapshot.machine,
        invokeDef.src
      );
      if (typeof logic === 'function') {
        logic = logic({
          actors: currentSnapshot.machine.implementations.actors
        });
      }
      const input =
        typeof invokeDef.input === 'function'
          ? invokeDef.input({
              self: actorScope.self,
              context: currentSnapshot.context,
              event
            })
          : invokeDef.input;
      const actorRef = createActor(logic, {
        ...invokeDef,
        input,
        parent: actorScope.self,
        syncSnapshot: !!invokeDef.onSnapshot
      });
      if (invokeDef.id) {
        children[invokeDef.id] = actorRef;
      }

      actions.push(
        // spawnChild(invokeDef.src, {
        //   ...invokeDef,
        //   syncSnapshot: !!invokeDef.onSnapshot
        // })
        {
          action: builtInActions['@xstate.start'],
          args: [actorRef]
        }
      );
    }

    if (invoked) {
      nextSnapshot = cloneMachineSnapshot(nextSnapshot, { children });
    }

    if (stateNodeToEnter.entry2) {
      actions.push(
        ...getActionsFromAction2(stateNodeToEnter.entry2, {
          context: nextSnapshot.context,
          event,
          self: actorScope.self,
          parent: actorScope.self._parent,
          children,
          actorScope,
          machine: currentSnapshot.machine
        })
      );
    }

    if (statesForDefaultEntry.has(stateNodeToEnter)) {
      // const initialActions = stateNodeToEnter.initial.actions;
      const initialActions = getTransitionActions(
        stateNodeToEnter.initial,
        nextSnapshot,
        event,
        actorScope
      );
      actions.push(...initialActions);
    }

    nextSnapshot = resolveActionsAndContext(
      nextSnapshot,
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
            parent.id,
            stateNodeToEnter.output !== undefined
              ? resolveOutput(
                  stateNodeToEnter.output,
                  nextSnapshot.context,
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

      nextSnapshot = cloneMachineSnapshot(nextSnapshot, {
        status: 'done',
        output: getMachineOutput(
          nextSnapshot,
          event,
          actorScope,
          nextSnapshot.machine.root,
          rootCompletionNode
        )
      });
    }
  }

  return nextSnapshot;
}

/**
 * Gets the transition result for a given transition without executing the
 * transition.
 */
export function getTransitionResult(
  transition: Pick<AnyTransitionDefinition, 'target' | 'fn' | 'source'> & {
    reenter?: AnyTransitionDefinition['reenter'];
  },
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
): {
  targets: Readonly<AnyStateNode[]> | undefined;
  context: MachineContext | undefined;
  actions: UnknownAction[];
  reenter?: boolean;
} {
  if (transition.fn) {
    const actions: UnknownAction[] = [];

    const enqueue = createEnqueueObject(
      {
        cancel: (id) => {
          actions.push(cancel(id));
        },
        raise: (event, options) => {
          actions.push(raise(event, options));
        },
        emit: (emittedEvent) => {
          actions.push(emittedEvent);
        },
        log: (...args) => {
          // actions.push(log(...args));
          actions.push({
            action: actorScope.logger,
            args
          });
        },
        spawn: (src, options) => {
          const actorRef = createActor(src, {
            ...options,
            parent: self
          });

          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });
          return actorRef;
        },
        sendTo: (actorRef, event, options) => {
          if (actorRef) {
            actions.push(sendTo(actorRef, event, options));
          }
        },
        stop: (actorRef) => {
          if (actorRef) {
            actions.push(() => {
              actorScope.stopChild(actorRef);
            });
          }
        }
      },
      (fn, ...args) => {
        actions.push({
          action: fn,
          args
        });
      }
    );

    const res = transition.fn(
      {
        context: snapshot.context,
        event,
        value: snapshot.value,
        children: snapshot.children,
        parent: self._parent,
        self,
        actions: snapshot.machine.implementations.actions,
        actors: snapshot.machine.implementations.actors,
        guards: snapshot.machine.implementations.guards
      },
      enqueue
    );

    const targets = res?.target
      ? // TODO: remove transition.initial and figure out a better way to
        // identify initial transitions
        transition.initial
        ? resolveInitialTarget(transition.source, [res.target])
        : resolveTarget(transition.source, [res.target])
      : undefined;

    return {
      targets: targets,
      context: res?.context,
      reenter: res?.reenter,
      actions
    };
  }

  return {
    targets: transition.target as AnyStateNode[] | undefined,
    context: undefined,
    reenter: transition.reenter,
    actions: []
  };
}

const builtInActions = {
  ['@xstate.start']: (actorRef: AnyActorRef) => {
    actorRef.start();
  }
};

export function getTransitionActions(
  transition: Pick<
    AnyTransitionDefinition,
    'target' | 'fn' | 'source' | 'actions'
  >,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
): Readonly<UnknownAction[]> {
  if (transition.fn) {
    const actions: UnknownAction[] = [];
    const enqueue = createEnqueueObject(
      {
        cancel: (id) => {
          actions.push(cancel(id));
        },
        raise: (event, options) => {
          actions.push(raise(event, options));
        },
        emit: (emittedEvent) => {
          actions.push(emittedEvent);
        },
        log: (...args) => {
          actions.push({
            action: actorScope.logger,
            args
          });
        },
        spawn: (logic, options) => {
          const actorRef = createActor(logic, {
            ...options,
            parent: actorScope.self
          });

          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });
          return actorRef;
        },
        sendTo: (actorRef, event, options) => {
          if (actorRef) {
            actions.push(sendTo(actorRef, event, options));
          }
        },
        stop: (actorRef) => {
          if (actorRef) {
            actions.push(() => actorScope.stopChild(actorRef));
          }
        }
      },
      (fn, ...args) => {
        actions.push({
          action: fn,
          args
        });
      }
    );

    transition.fn(
      {
        context: snapshot.context,
        event,
        value: snapshot.value,
        children: snapshot.children,
        parent: actorScope.self._parent,
        self: actorScope.self,
        actions: snapshot.machine.implementations.actions,
        actors: snapshot.machine.implementations.actors
      },
      enqueue
    );

    return actions;
  }

  return transition.actions;
}

function computeEntrySet(
  transitions: Array<AnyTransitionDefinition>,
  historyValue: HistoryValue<any, any>,
  statesForDefaultEntry: Set<AnyStateNode>,
  statesToEnter: Set<AnyStateNode>,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
) {
  for (const t of transitions) {
    const domain = getTransitionDomain(
      t,
      historyValue,
      snapshot,
      event,
      self,
      actorScope
    );

    const { targets, reenter } = getTransitionResult(
      t,
      snapshot,
      event,
      self,
      actorScope
    );

    for (const s of targets ?? []) {
      if (
        !isHistoryNode(s) &&
        // if the target is different than the source then it will *definitely* be entered
        (t.source !== s ||
          // we know that the domain can't lie within the source
          // if it's different than the source then it's outside of it and it means that the target has to be entered as well
          t.source !== domain ||
          // reentering transitions always enter the target, even if it's the source itself
          reenter)
      ) {
        statesToEnter.add(s);
        statesForDefaultEntry.add(s);
      }
      addDescendantStatesToEnter(
        s,
        historyValue,
        statesForDefaultEntry,
        statesToEnter,
        snapshot,
        event,
        self,
        actorScope
      );
    }
    const targetStates = getEffectiveTargetStates(
      t,
      historyValue,
      snapshot,
      event,
      self,
      actorScope
    );
    for (const s of targetStates) {
      const ancestors = getProperAncestors(s, domain);
      if (domain?.type === 'parallel') {
        ancestors.push(domain);
      }
      addAncestorStatesToEnter(
        statesToEnter,
        historyValue,
        statesForDefaultEntry,
        ancestors,
        !t.source.parent && reenter ? undefined : domain,
        snapshot,
        event,
        self,
        actorScope
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
  statesToEnter: Set<AnyStateNode>,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
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
          statesToEnter,
          snapshot,
          event,
          self,
          actorScope
        );
      }
      for (const s of historyStateNodes) {
        addProperAncestorStatesToEnter(
          s,
          stateNode.parent,
          statesToEnter,
          historyValue,
          statesForDefaultEntry,
          snapshot,
          event,
          self,
          actorScope
        );
      }
    } else {
      const historyDefaultTransition = resolveHistoryDefaultTransition<
        TContext,
        TEvent
      >(stateNode);
      const { targets } = getTransitionResult(
        historyDefaultTransition,
        snapshot,
        event,
        self,
        actorScope
      );
      for (const s of targets ?? []) {
        statesToEnter.add(s);

        if (historyDefaultTransition === stateNode.parent?.initial) {
          statesForDefaultEntry.add(stateNode.parent);
        }

        addDescendantStatesToEnter(
          s,
          historyValue,
          statesForDefaultEntry,
          statesToEnter,
          snapshot,
          event,
          self,
          actorScope
        );
      }

      for (const s of targets ?? []) {
        addProperAncestorStatesToEnter(
          s,
          stateNode.parent,
          statesToEnter,
          historyValue,
          statesForDefaultEntry,
          snapshot,
          event,
          self,
          actorScope
        );
      }
    }
  } else {
    if (stateNode.type === 'compound') {
      const [initialState] = getTransitionResult(
        stateNode.initial,
        snapshot,
        event,
        self,
        actorScope
      ).targets!;

      if (!isHistoryNode(initialState)) {
        statesToEnter.add(initialState);
        statesForDefaultEntry.add(initialState);
      }
      addDescendantStatesToEnter(
        initialState,
        historyValue,
        statesForDefaultEntry,
        statesToEnter,
        snapshot,
        event,
        self,
        actorScope
      );

      addProperAncestorStatesToEnter(
        initialState,
        stateNode,
        statesToEnter,
        historyValue,
        statesForDefaultEntry,
        snapshot,
        event,
        self,
        actorScope
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
              statesToEnter,
              snapshot,
              event,
              self,
              actorScope
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
  reentrancyDomain: AnyStateNode | undefined,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
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
            statesToEnter,
            snapshot,
            event,
            self,
            actorScope
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
  statesForDefaultEntry: Set<AnyStateNode>,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
) {
  addAncestorStatesToEnter(
    statesToEnter,
    historyValue,
    statesForDefaultEntry,
    getProperAncestors(stateNode, toStateNode),
    undefined,
    snapshot,
    event,
    self,
    actorScope
  );
}

function exitStates(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  transitions: AnyTransitionDefinition[],
  mutStateNodeSet: Set<AnyStateNode>,
  historyValue: HistoryValue<any, any>,
  internalQueue: AnyEventObject[],
  _actionExecutor: ActionExecutor
) {
  let nextSnapshot = currentSnapshot;
  const statesToExit = computeExitSet(
    transitions,
    mutStateNodeSet,
    historyValue,
    currentSnapshot,
    event,
    actorScope.self,
    actorScope
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
    const exitActions = s.exit2
      ? getActionsFromAction2(s.exit2, {
          context: nextSnapshot.context,
          event,
          self: actorScope.self,
          parent: actorScope.self._parent,
          children: actorScope.self.getSnapshot().children,
          actorScope,
          machine: currentSnapshot.machine
        })
      : s.exit;
    nextSnapshot = resolveActionsAndContext(
      nextSnapshot,
      event,
      actorScope,
      [...exitActions, ...s.invoke.map((def) => stopChild(def.id))],
      internalQueue,
      undefined
    );
    mutStateNodeSet.delete(s);
  }
  return [nextSnapshot, changedHistory || historyValue] as const;
}

export interface BuiltinAction {
  (): void;
  type: `xstate.${string}`;
  resolve: (
    actorScope: AnyActorScope,
    snapshot: AnyMachineSnapshot,
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
    snapshot: AnyMachineSnapshot,
    params: unknown
  ) => void;
  execute: (actorScope: AnyActorScope, params: unknown) => void;
}

function getAction(machine: AnyStateMachine, actionType: string) {
  return machine.implementations.actions[actionType];
}

function resolveAndExecuteActionsWithContext(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  actions: UnknownAction[],
  extra: {
    internalQueue: AnyEventObject[];
    deferredActorIds: string[] | undefined;
  },
  retries: (readonly [BuiltinAction, unknown])[] | undefined
): AnyMachineSnapshot {
  const { machine } = currentSnapshot;
  let intermediateSnapshot = currentSnapshot;

  for (const action of actions) {
    const isInline = typeof action === 'function';

    const resolvedAction = isInline
      ? action
      : typeof action === 'object' &&
          'action' in action &&
          typeof action.action === 'function'
        ? action.action.bind(null, ...action.args)
        : // the existing type of `.actions` assumes non-nullable `TExpressionAction`
          // it's fine to cast this here to get a common type and lack of errors in the rest of the code
          // our logic below makes sure that we call those 2 "variants" correctly

          getAction(machine, typeof action === 'string' ? action : action.type);

    // if no action, emit it!
    if (!resolvedAction && typeof action === 'object' && action !== null) {
      actorScope.defer(() => {
        actorScope.emit(action);
      });
    }

    const actionArgs = {
      context: intermediateSnapshot.context,
      event,
      self: actorScope.self,
      system: actorScope.system,
      children: intermediateSnapshot.children,
      parent: actorScope.self._parent,
      actions: currentSnapshot.machine.implementations.actions,
      actors: currentSnapshot.machine.implementations.actors
    };

    let actionParams =
      isInline || typeof action === 'string'
        ? undefined
        : 'params' in action
          ? typeof action.params === 'function'
            ? action.params({ context: intermediateSnapshot.context, event })
            : action.params
          : // Emitted event
            undefined;

    // Emitted events
    if (!actionParams && typeof action === 'object' && action !== null) {
      const { type: _, ...emittedEventParams } = action as any;
      actionParams = emittedEventParams;
    }

    if (resolvedAction && '_special' in resolvedAction) {
      const specialAction = resolvedAction as unknown as Action2<
        any,
        any,
        any,
        any,
        any
      >;

      const res = specialAction(actionArgs, emptyEnqueueObject);

      if (res?.context || res?.children) {
        intermediateSnapshot = cloneMachineSnapshot(intermediateSnapshot, {
          context: res.context,
          children: res.children
        });
      }
      continue;
    }

    if (!resolvedAction || !('resolve' in resolvedAction)) {
      actorScope.actionExecutor({
        type:
          typeof action === 'string'
            ? action
            : typeof action === 'object'
              ? 'action' in action && typeof action.action === 'function'
                ? (action.action.name ?? '(anonymous)')
                : action.type
              : action.name || '(anonymous)',
        info: actionArgs,
        params: actionParams,
        args:
          typeof action === 'object' && 'action' in action ? action.args : [],
        exec: resolvedAction
      });
      continue;
    }

    const builtinAction = resolvedAction as BuiltinAction;

    const [nextState, params, actions] = builtinAction.resolve(
      actorScope,
      intermediateSnapshot,
      actionArgs,
      actionParams,
      resolvedAction, // this holds all params
      extra
    );
    intermediateSnapshot = nextState;

    if ('retryResolve' in builtinAction) {
      retries?.push([builtinAction, params]);
    }

    if ('execute' in builtinAction) {
      actorScope.actionExecutor({
        type: builtinAction.type,
        info: actionArgs,
        params,
        args: [],
        exec: builtinAction.execute.bind(null, actorScope, params)
      });
    }

    if (actions) {
      intermediateSnapshot = resolveAndExecuteActionsWithContext(
        intermediateSnapshot,
        event,
        actorScope,
        actions,
        extra,
        retries
      );
    }
  }

  return intermediateSnapshot;
}

export function resolveActionsAndContext(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  actions: UnknownAction[],
  internalQueue: AnyEventObject[],
  deferredActorIds: string[] | undefined
): AnyMachineSnapshot {
  const retries: (readonly [BuiltinAction, unknown])[] | undefined =
    deferredActorIds ? [] : undefined;
  const nextState = resolveAndExecuteActionsWithContext(
    currentSnapshot,
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
  snapshot: AnyMachineSnapshot,
  event: EventObject,
  actorScope: AnyActorScope,
  internalQueue: AnyEventObject[]
): {
  snapshot: typeof snapshot;
  microstates: Array<typeof snapshot>;
} {
  if (isDevelopment && event.type === WILDCARD) {
    throw new Error(`An event cannot have the wildcard type ('${WILDCARD}')`);
  }

  let nextSnapshot = snapshot;
  const microstates: AnyMachineSnapshot[] = [];

  function addMicrostate(
    microstate: AnyMachineSnapshot,
    event: AnyEventObject,
    transitions: AnyTransitionDefinition[]
  ) {
    // collect microsteps for unified '@xstate.transition'
    (actorScope.self as any)._collectedMicrosteps = [
      ...(((actorScope.self as any)._collectedMicrosteps as any[]) || []),
      ...transitions
    ];
    microstates.push(microstate);
  }

  // Handle stop event
  if (event.type === XSTATE_STOP) {
    nextSnapshot = cloneMachineSnapshot(
      stopChildren(nextSnapshot, event, actorScope),
      {
        status: 'stopped'
      }
    );
    addMicrostate(nextSnapshot, event, []);

    return {
      snapshot: nextSnapshot,
      microstates
    };
  }

  let nextEvent = event;

  // Assume the state is at rest (no raised events)
  // Determine the next state based on the next microstep
  if (nextEvent.type !== XSTATE_INIT) {
    const currentEvent = nextEvent;
    const isErr = isErrorActorEvent(currentEvent);

    const transitions = selectTransitions(
      currentEvent,
      nextSnapshot,
      actorScope.self
    );

    if (isErr && !transitions.length) {
      // TODO: we should likely only allow transitions selected by very explicit descriptors
      // `*` shouldn't be matched, likely `xstate.error.*` shouldn't be either
      // similarly `xstate.error.actor.*` and `xstate.error.actor.todo.*` have to be considered too
      nextSnapshot = cloneMachineSnapshot<typeof snapshot>(snapshot, {
        status: 'error',
        error: currentEvent.error
      });
      addMicrostate(nextSnapshot, currentEvent, []);
      return {
        snapshot: nextSnapshot,
        microstates
      };
    }
    nextSnapshot = microstep(
      transitions,
      snapshot,
      actorScope,
      nextEvent,
      false, // isInitial
      internalQueue
    );
    addMicrostate(nextSnapshot, currentEvent, transitions);
  }

  let shouldSelectEventlessTransitions = true;

  while (nextSnapshot.status === 'active') {
    let enabledTransitions: AnyTransitionDefinition[] =
      shouldSelectEventlessTransitions
        ? selectEventlessTransitions(
            nextSnapshot,
            nextEvent,
            actorScope.self,
            actorScope
          )
        : [];

    // eventless transitions should always be selected after selecting *regular* transitions
    // by assigning `undefined` to `previousState` we ensure that `shouldSelectEventlessTransitions` gets always computed to true in such a case
    const previousState = enabledTransitions.length ? nextSnapshot : undefined;

    if (!enabledTransitions.length) {
      if (!internalQueue.length) {
        break;
      }
      nextEvent = internalQueue.shift()!;
      enabledTransitions = selectTransitions(
        nextEvent,
        nextSnapshot,
        actorScope.self
      );
    }

    nextSnapshot = microstep(
      enabledTransitions,
      nextSnapshot,
      actorScope,
      nextEvent,
      false,
      internalQueue
    );
    shouldSelectEventlessTransitions = nextSnapshot !== previousState;
    addMicrostate(nextSnapshot, nextEvent, enabledTransitions);
  }

  if (nextSnapshot.status !== 'active' && nextSnapshot.children) {
    stopChildren(nextSnapshot, nextEvent, actorScope);
  }

  return {
    snapshot: nextSnapshot,
    microstates
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
    Object.values(nextState.children ?? {})
      .filter(Boolean)
      .map((child: any) => stopChild(child)),
    [],
    undefined
  );
}

function selectTransitions(
  event: AnyEventObject,
  nextState: AnyMachineSnapshot,
  self: AnyActorRef
): AnyTransitionDefinition[] {
  return nextState.machine.getTransitionData(nextState as any, event, self);
}

function selectEventlessTransitions(
  nextState: AnyMachineSnapshot,
  event: AnyEventObject,
  self: AnyActorRef,
  actorScope: AnyActorScope
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
          evaluateCandidate(
            transition,
            nextState.context,
            event,
            nextState,
            s,
            self
          )
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
    nextState.historyValue,
    nextState,
    event,
    self,
    actorScope
  );
}

/**
 * Resolves a partial state value with its full representation in the state
 * node's machine.
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

function createEnqueueObject(
  props: Partial<EnqueueObject<any, any>>,
  action: <T extends (...args: any[]) => any>(
    fn: T,
    ...args: Parameters<T>
  ) => void
): EnqueueObject<any, any> {
  const enqueueFn = (
    fn: (...args: any[]) => any,
    ...args: Parameters<typeof fn>
  ) => {
    action(fn, ...args);
  };

  Object.assign(enqueueFn, {
    cancel: () => {},
    emit: () => {},
    log: () => {},
    raise: () => {},
    spawn: () => ({}) as any,
    sendTo: () => {},
    stop: () => {},
    ...props
  });

  return enqueueFn as any;
}

export const emptyEnqueueObject = createEnqueueObject({}, () => {});

function getActionsFromAction2(
  action2: Action2<any, any, any, any, any>,
  {
    context,
    event,
    parent,
    self,
    children,
    actorScope,
    machine
  }: {
    context: MachineContext;
    event: EventObject;
    self: AnyActorRef;
    parent: AnyActorRef | undefined;
    children: Record<string, AnyActorRef>;
    actorScope: AnyActorScope;
    machine: AnyStateMachine;
  }
) {
  if (action2.length === 2) {
    // enqueue action; retrieve
    const actions: any[] = [];

    const enqueue = createEnqueueObject(
      {
        cancel: (id: string) => {
          actions.push(cancel(id));
        },
        emit: (emittedEvent) => {
          actions.push(emittedEvent);
        },
        log: (...args) => {
          actions.push({
            action: actorScope.logger,
            args
          });
        },
        raise: (raisedEvent, options) => {
          actions.push(raise(raisedEvent, options));
        },
        spawn: (logic, options) => {
          const actorRef = createActor(logic, { ...options, parent: self });

          // actions.push({
          //   action: actorRef.start,
          //   args: []
          // });
          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });
          return actorRef;
        },
        sendTo: (actorRef, event, options) => {
          if (actorRef) {
            actions.push(sendTo(actorRef, event, options));
          }
        },
        stop: (actorRef) => {
          if (actorRef) {
            actions.push(stopChild(actorRef));
          }
        }
      },
      (action, ...args) => {
        actions.push({
          action,
          args
        });
      }
    );

    const res = action2(
      {
        context,
        event,
        parent,
        self,
        children,
        system: actorScope.system,
        actions: machine.implementations.actions,
        actors: machine.implementations.actors
      },
      enqueue
    );

    if (res?.context) {
      actions.push(assign(res.context));
    }

    return actions;
  }

  return [action2];
}

export function hasEffect(
  transition: AnyTransitionDefinition,
  context: MachineContext,
  event: EventObject,
  snapshot: AnyMachineSnapshot,
  self: AnyActorRef
): boolean {
  if (transition.fn) {
    let hasEffect = false;
    let res;

    try {
      const triggerEffect = () => {
        hasEffect = true;
        throw new Error('Effect triggered');
      };
      res = transition.fn(
        {
          context,
          event,
          self,
          value: snapshot.value,
          children: snapshot.children,
          parent: {
            send: triggerEffect
          } as any,
          actions: snapshot.machine.implementations.actions,
          actors: snapshot.machine.implementations.actors
        },
        createEnqueueObject(
          {
            emit: triggerEffect,
            cancel: triggerEffect,
            log: triggerEffect,
            raise: triggerEffect,
            spawn: triggerEffect,
            sendTo: triggerEffect,
            stop: triggerEffect
          },
          triggerEffect
        )
      );
    } catch (err) {
      if (hasEffect) {
        return true;
      }
      throw err;
    }

    return res !== undefined;
  }

  return false;
}

export function evaluateCandidate(
  candidate: TransitionDefinition<any, any>,
  context: MachineContext,
  event: EventObject,
  snapshot: AnyMachineSnapshot,
  stateNode: AnyStateNode,
  self: AnyActorRef
): boolean {
  if (candidate.fn) {
    let hasEffect = false;
    let res;

    try {
      const triggerEffect = () => {
        hasEffect = true;
        throw new Error('Effect triggered');
      };
      res = candidate.fn(
        {
          context,
          event,
          self,
          parent: {
            send: triggerEffect
          },
          value: snapshot.value,
          children: snapshot.children,
          actions: stateNode.machine.implementations.actions,
          actors: stateNode.machine.implementations.actors,
          guards: stateNode.machine.implementations.guards
        },
        createEnqueueObject(
          {
            emit: triggerEffect,
            cancel: triggerEffect,
            log: triggerEffect,
            raise: triggerEffect,
            spawn: triggerEffect,
            sendTo: triggerEffect,
            stop: triggerEffect
          },
          triggerEffect
        )
      );
    } catch (err) {
      if (hasEffect) {
        return true;
      }
      throw err;
    }

    return res !== undefined;
  }

  const { guard } = candidate;

  let result: boolean;
  try {
    result = !guard || evaluateGuard(guard, context, event, snapshot);
  } catch (err: any) {
    const guardType =
      typeof guard === 'string'
        ? guard
        : typeof guard === 'object'
          ? guard.type
          : undefined;
    throw new Error(
      `Unable to evaluate guard ${
        guardType ? `'${guardType}' ` : ''
      }in transition for event '${event.type}' in state node '${
        stateNode.id
      }':\n${err.message}`
    );
  }

  return result;
}
