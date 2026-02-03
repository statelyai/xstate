import isDevelopment from '#is-development';
import { MachineSnapshot, cloneMachineSnapshot } from './State.ts';
import type { StateNode } from './StateNode.ts';
import { createAfterEvent, createDoneStateEvent } from './eventUtils.ts';
import {
  XSTATE_INIT,
  STATE_DELIMITER,
  STATE_IDENTIFIER,
  XSTATE_STOP
} from './constants.ts';
import { matchesEventDescriptor } from './utils.ts';
import {
  AnyActorLogic,
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateNode,
  AnyTransitionDefinition,
  DelayedTransitionDefinition,
  EventObject,
  HistoryValue,
  MachineContext,
  StateValue,
  StateValueMap,
  TransitionDefinition,
  AnyAction,
  AnyTransitionConfig,
  AnyActorScope,
  AnyStateMachine,
  EnqueueObject,
  Action,
  AnyActorRef
} from './types.ts';
import {
  resolveOutput,
  normalizeTarget,
  toArray,
  toStatePath,
  isErrorActorEvent
} from './utils.ts';
import { createActor, ProcessingStatus } from './createActor.ts';
import { builtInActions } from './actions.ts';
import { listenerLogic, type ListenerInput } from './actors/listener.ts';
import {
  subscriptionLogic,
  type SubscriptionInput,
  type SubscriptionMappers
} from './actors/subscription.ts';

type AnyStateNodeIterable = Iterable<AnyStateNode>;

type AdjList = Map<AnyStateNode, Array<AnyStateNode>>;

export function isAtomicStateNode(stateNode: AnyStateNode) {
  return stateNode.type === 'atomic' || stateNode.type === 'final';
}

function getChildren(stateNode: AnyStateNode): Array<AnyStateNode> {
  return Object.values(stateNode.states).filter((sn) => sn.type !== 'history');
}

export function getProperAncestors(
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

function getAdjList(stateNodes: AnyStateNodeIterable): AdjList {
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
      .filter((eventDescriptor) =>
        matchesEventDescriptor(receivedEventType, eventDescriptor)
      )
      .sort((a, b) => b.length - a.length)
      .flatMap((key) => stateNode.transitions.get(key)!);

  return candidates;
}

export function mutateEntryExit(
  stateNode: AnyStateNode,
  entryFn?: (x: any, enq: EnqueueObject<any, any>) => void,
  exitFn?: (x: any, enq: EnqueueObject<any, any>) => void
) {
  if (entryFn) {
    const oldEntry = stateNode.entry;
    stateNode.entry = (x, enq) => {
      entryFn(x, enq);
      return oldEntry?.(x, enq);
    };
  }
  if (exitFn) {
    const oldExit = stateNode.exit;
    stateNode.exit = (x, enq) => {
      exitFn(x, enq);
      return oldExit?.(x, enq);
    };
  }
  return stateNode;
}

/** All delayed transitions from the config. */
export function getDelayedTransitions(
  stateNode: AnyStateNode
): Array<DelayedTransitionDefinition<MachineContext, EventObject>> {
  const afterConfig = stateNode.config.after;
  if (!afterConfig) {
    return [];
  }

  const mutateEntryExitWithDelay = (delay: string | number) => {
    const afterEvent = createAfterEvent(delay, stateNode.id);
    const eventType = afterEvent.type;

    mutateEntryExit(
      stateNode,
      // entry
      (x, enq) => {
        let resolvedDelay = typeof delay === 'string' ? x.delays[delay] : delay;

        if (typeof resolvedDelay === 'function') {
          resolvedDelay = resolvedDelay(x);
        }
        enq.raise(afterEvent, {
          id: eventType,
          delay: resolvedDelay
        });
      },
      // exit
      (_, enq) => {
        enq.cancel(eventType);
      }
    );

    return eventType;
  };

  const delayedTransitions = Object.keys(afterConfig).flatMap((delay) => {
    const configTransition = afterConfig[delay];
    const resolvedTransition =
      typeof configTransition === 'string'
        ? { target: configTransition }
        : typeof configTransition === 'function'
          ? { to: configTransition }
          : configTransition;
    const resolvedDelay = Number.isNaN(+delay) ? delay : +delay;
    const eventType = mutateEntryExitWithDelay(resolvedDelay);
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

function resolveHistoryDefaultTransition(
  stateNode: AnyStateNode & { type: 'history' }
): AnyTransitionDefinition {
  const normalizedTarget = normalizeTarget(stateNode.config.target);
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
      iter(descStateNode.initial.target![0]);
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

function transitionAtomicNode(
  stateNode: AnyStateNode,
  stateValue: string,
  snapshot: AnyMachineSnapshot,
  event: EventObject,
  self: AnyActorRef
): Array<AnyTransitionDefinition> | undefined {
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
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
): Array<AnyTransitionDefinition> {
  const filteredTransitions = new Set<AnyTransitionDefinition>();

  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = new Set<AnyTransitionDefinition>();
    for (const t2 of filteredTransitions) {
      if (
        hasIntersection(
          computeExitSet([t1], stateNodeSet, snapshot, event, actorScope),
          computeExitSet([t2], stateNodeSet, snapshot, event, actorScope)
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
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
): Array<AnyStateNode> {
  const historyValue = snapshot.historyValue;
  const { targets } = getTransitionResult(
    transition,
    snapshot,
    event,
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
          snapshot,
          event,
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
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
): AnyStateNode | undefined {
  const targetStates = getEffectiveTargetStates(
    transition,
    snapshot,
    event,
    actorScope
  );

  if (!targetStates) {
    return;
  }

  const { reenter } = getTransitionResult(
    transition,
    snapshot,
    event,
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
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
): Array<AnyStateNode> {
  const statesToExit = new Set<AnyStateNode>();
  for (const transition of transitions) {
    const { targets } = getTransitionResult(
      transition,
      snapshot,
      event,
      actorScope
    );

    if (targets?.length) {
      const domain = getTransitionDomain(
        transition,
        snapshot,
        event,
        actorScope
      );

      if (transition.reenter && transition.source === domain) {
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
  const mutStateNodeSet = new Set(currentSnapshot._nodes as StateNode[]);
  let historyValue = currentSnapshot.historyValue;

  const filteredTransitions = removeConflictingTransitions(
    transitions,
    mutStateNodeSet,
    currentSnapshot,
    event,
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
      internalQueue
    );
  }

  let context = nextState.context;
  const actions: AnyAction[] = [];
  const internalEvents: EventObject[] = [];

  for (const t of filteredTransitions) {
    const res = getTransitionResult(t, currentSnapshot, event, actorScope);
    if (res.context) {
      context = res.context;
    }
    if (res.actions) {
      actions.push(...res.actions);
    }
    if (res.internalEvents) {
      internalEvents.push(...res.internalEvents);
    }
  }

  if (internalEvents?.length) {
    internalQueue.push(...internalEvents);
  }

  // Execute transition content
  nextState = resolveAndExecuteActionsWithContext(
    nextState,
    event,
    actorScope,
    actions
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
    const allExitActions: AnyAction[] = [];
    const nextStateNodesToExit = nextStateNodes.sort(
      (a, b) => b.order - a.order
    );

    nextStateNodesToExit.forEach((stateNode) => {
      if (stateNode.exit) {
        const [actions, , internalEvents] =
          getActionsAndContextFromTransitionFn(stateNode.exit, {
            context: nextState.context,
            event,
            self: actorScope.self,
            parent: actorScope.self._parent,
            children: nextState.children,
            actorScope,
            machine: currentSnapshot.machine
          });
        allExitActions.push(...actions);
        if (internalEvents?.length) {
          internalQueue.push(...internalEvents);
        }
      }
    });
    nextState = resolveAndExecuteActionsWithContext(
      nextState,
      event,
      actorScope,
      allExitActions
    );
  }

  // eslint-disable-next-line no-useless-catch
  try {
    if (
      historyValue === currentSnapshot.historyValue &&
      areStateNodeCollectionsEqual(
        currentSnapshot._nodes as StateNode[],
        mutStateNodeSet
      )
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
  historyValue: HistoryValue,
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
    const actions: AnyAction[] = [];

    for (const invokeDef of stateNodeToEnter.invoke) {
      invoked = true;

      // src can be logic, an actor, or a function returning either
      let srcResult = invokeDef.logic;
      if (typeof srcResult === 'function') {
        srcResult = srcResult({
          actors: currentSnapshot.machine.implementations.actors,
          context: currentSnapshot.context,
          event,
          self: actorScope.self
        });
      }

      // Check if srcResult is an actor (has _processingStatus) or logic
      const isActor =
        srcResult &&
        typeof srcResult === 'object' &&
        '_processingStatus' in srcResult;

      let actorRef: AnyActorRef;

      if (isActor) {
        // srcResult is already an actor
        const existingActor = srcResult as unknown as AnyActorRef;
        const isAlreadyStarted =
          existingActor._processingStatus === ProcessingStatus.Running;

        if (isAlreadyStarted) {
          // External actor - subscribe but don't manage lifecycle
          actorRef = existingActor;
          (actorRef as any)._syncSnapshot = !!invokeDef.onSnapshot;
          (actorRef as any)._isExternal = true;
        } else {
          // Unstarted actor - recreate with proper parent context
          // We need to use the actor's logic to create a new actor
          // with the parent's system
          const actorLogic = (existingActor as any).logic;
          actorRef = createActor(actorLogic, {
            ...invokeDef,
            input: (existingActor as any).options?.input,
            parent: actorScope.self,
            syncSnapshot: !!invokeDef.onSnapshot
          });

          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });
        }
      } else {
        // srcResult is logic, create an actor from it
        const logic = srcResult;
        const input =
          typeof invokeDef.input === 'function'
            ? invokeDef.input({
                self: actorScope.self,
                context: currentSnapshot.context,
                event
              })
            : invokeDef.input;
        actorRef = createActor(logic, {
          ...invokeDef,
          input,
          parent: actorScope.self,
          syncSnapshot: !!invokeDef.onSnapshot
        });

        actions.push({
          action: builtInActions['@xstate.start'],
          args: [actorRef]
        });
      }

      if (invokeDef.id) {
        children[invokeDef.id] = actorRef;
      }
    }

    if (invoked) {
      nextSnapshot = cloneMachineSnapshot(nextSnapshot, { children });
    }
    let context: MachineContext | undefined;

    if (stateNodeToEnter.entry) {
      const [resultActions, nextContext, internalEvents] =
        getActionsAndContextFromTransitionFn(stateNodeToEnter.entry, {
          context: nextSnapshot.context,
          event,
          self: actorScope.self,
          parent: actorScope.self._parent,
          children,
          actorScope,
          machine: currentSnapshot.machine
        });
      actions.push(...resultActions);
      if (internalEvents?.length) {
        internalQueue.push(...internalEvents);
      }
      if (nextContext) {
        context = nextContext;
      }
    }

    if (statesForDefaultEntry.has(stateNodeToEnter)) {
      const { actions: initialActions } = getTransitionResult(
        stateNodeToEnter.initial,
        nextSnapshot,
        event,
        actorScope
      );
      if (initialActions) actions.push(...initialActions);
    }

    nextSnapshot = resolveAndExecuteActionsWithContext(
      nextSnapshot,
      event,
      actorScope,
      actions
    );

    if (context) {
      nextSnapshot.context = context;
    }

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
  transition: Pick<AnyTransitionDefinition, 'target' | 'to' | 'source'> & {
    reenter?: AnyTransitionDefinition['reenter'];
  },
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
): {
  targets: Readonly<AnyStateNode[]> | undefined;
  context: MachineContext | undefined;
  actions: AnyAction[] | undefined;
  reenter?: boolean;
  internalEvents: EventObject[] | undefined;
} {
  if (transition.to) {
    const actions: AnyAction[] = [];
    const internalEvents: EventObject[] = [];
    const enqueue = createEnqueueObject(
      {
        cancel: (id) => {
          actions.push({
            action: builtInActions['@xstate.cancel'],
            args: [actorScope, id]
          });
        },
        raise: (event, options) => {
          if (options?.delay !== undefined) {
            const delay = options.delay;
            // actions.push(raise(event, options));
            actions.push({
              action: () => {
                actorScope.system.scheduler.schedule(
                  actorScope.self,
                  actorScope.self,
                  event,
                  delay,
                  options?.id
                );
              },
              args: []
            });
          } else {
            internalEvents.push(event);
          }
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
            parent: actorScope.self
          });

          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });
          return actorRef;
        },
        sendTo: (actorRef, event, options) => {
          // if (options?.delay !== undefined) {
          //   actions.push(sendTo(actorRef, event, options));
          // } else {
          //   actions.push({
          //     action: () => {
          //       actorScope.system._relay(actorScope.self, actorRef, event);
          //     },
          //     args: []
          //   });
          // }
          actions.push({
            action: builtInActions['@xstate.sendTo'],
            args: [actorScope, actorRef, event, options]
          });
        },
        stop: (actorRef) => {
          if (actorRef) {
            actions.push({
              action: builtInActions['@xstate.stopChild'],
              args: [actorScope, actorRef]
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

    const res = transition.to(
      {
        context: snapshot.context,
        event,
        value: snapshot.value,
        children: snapshot.children,
        parent: actorScope.self._parent,
        self: actorScope.self,
        actions: snapshot.machine.implementations.actions,
        actors: snapshot.machine.implementations.actors,
        guards: snapshot.machine.implementations.guards,
        delays: snapshot.machine.implementations.delays
      },
      enqueue
    );

    const targets = res?.target
      ? resolveTarget(transition.source, [res.target])
      : undefined;

    return {
      targets: targets,
      context: res?.context,
      reenter: res?.reenter,
      actions,
      internalEvents
    };
  }

  return {
    targets: transition.target as AnyStateNode[] | undefined,
    context: undefined,
    reenter: transition.reenter,
    actions: undefined,
    internalEvents: undefined
  };
}

function computeEntrySet(
  transitions: Array<AnyTransitionDefinition>,
  historyValue: HistoryValue,
  statesForDefaultEntry: Set<AnyStateNode>,
  statesToEnter: Set<AnyStateNode>,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
) {
  for (const transition of transitions) {
    const domain = getTransitionDomain(transition, snapshot, event, actorScope);

    const { targets, reenter } = getTransitionResult(
      transition,
      snapshot,
      event,
      actorScope
    );

    for (const targetNode of targets ?? []) {
      if (
        !isHistoryNode(targetNode) &&
        // if the target is different than the source then it will *definitely* be entered
        (transition.source !== targetNode ||
          // we know that the domain can't lie within the source
          // if it's different than the source then it's outside of it and it means that the target has to be entered as well
          transition.source !== domain ||
          // reentering transitions always enter the target, even if it's the source itself
          reenter)
      ) {
        statesToEnter.add(targetNode);
        statesForDefaultEntry.add(targetNode);
      }
      addDescendantStatesToEnter(
        targetNode,
        historyValue,
        statesForDefaultEntry,
        statesToEnter,
        snapshot,
        event,
        actorScope
      );
    }
    const targetStates = getEffectiveTargetStates(
      transition,
      snapshot,
      event,
      actorScope
    );
    for (const s of targetStates) {
      const ancestors = getProperAncestors(s, domain);
      if (domain?.type === 'parallel') {
        ancestors.push(domain);
      }
      addAncestorStatesToEnter(
        statesToEnter,
        statesForDefaultEntry,
        ancestors,
        !transition.source.parent && reenter ? undefined : domain,
        snapshot,
        event,
        actorScope
      );
    }
  }
}

function addDescendantStatesToEnter(
  stateNode: AnyStateNode,
  historyValue: HistoryValue,
  statesForDefaultEntry: Set<AnyStateNode>,
  statesToEnter: Set<AnyStateNode>,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
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
          actorScope
        );
      }
      for (const s of historyStateNodes) {
        addProperAncestorStatesToEnter(
          s,
          stateNode.parent,
          statesToEnter,
          statesForDefaultEntry,
          snapshot,
          event,
          actorScope
        );
      }
    } else {
      const historyDefaultTransition =
        resolveHistoryDefaultTransition(stateNode);
      const { targets } = getTransitionResult(
        historyDefaultTransition,
        snapshot,
        event,
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
          actorScope
        );
      }

      for (const s of targets ?? []) {
        addProperAncestorStatesToEnter(
          s,
          stateNode.parent,
          statesToEnter,
          statesForDefaultEntry,
          snapshot,
          event,
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
        actorScope
      );

      addProperAncestorStatesToEnter(
        initialState,
        stateNode,
        statesToEnter,
        statesForDefaultEntry,
        snapshot,
        event,
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
  statesForDefaultEntry: Set<AnyStateNode>,
  ancestors: AnyStateNode[],
  reentrancyDomain: AnyStateNode | undefined,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
) {
  const historyValue = snapshot.historyValue;
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
  statesForDefaultEntry: Set<AnyStateNode>,
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
) {
  addAncestorStatesToEnter(
    statesToEnter,
    statesForDefaultEntry,
    getProperAncestors(stateNode, toStateNode),
    undefined,
    snapshot,
    event,
    actorScope
  );
}

function exitStates(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  transitions: AnyTransitionDefinition[],
  mutStateNodeSet: Set<AnyStateNode>,
  historyValue: HistoryValue,
  internalQueue: AnyEventObject[]
) {
  let nextSnapshot = currentSnapshot;
  const statesToExit = computeExitSet(
    transitions,
    mutStateNodeSet,
    currentSnapshot,
    event,
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

  for (const exitStateNode of statesToExit) {
    const [exitActions, nextContext, internalEvents] = exitStateNode.exit
      ? getActionsAndContextFromTransitionFn(exitStateNode.exit, {
          context: nextSnapshot.context,
          event,
          self: actorScope.self,
          parent: actorScope.self._parent,
          children: currentSnapshot.children,
          actorScope,
          machine: currentSnapshot.machine
        })
      : [[]];
    if (internalEvents?.length) {
      internalQueue.push(...internalEvents);
    }
    // Apply context changes from exit actions before executing other actions
    if (nextContext) {
      nextSnapshot = cloneMachineSnapshot(nextSnapshot, {
        context: nextContext
      });
    }
    nextSnapshot = resolveAndExecuteActionsWithContext(
      nextSnapshot,
      event,
      actorScope,
      exitActions
    );
    for (const def of exitStateNode.invoke) {
      const childActor = nextSnapshot.children[def.id];
      // Only stop owned actors, not external ones
      if (childActor && !childActor._isExternal) {
        actorScope.stopChild(childActor);
      }
      delete nextSnapshot.children[def.id];
    }

    mutStateNodeSet.delete(exitStateNode);
  }
  return [nextSnapshot, changedHistory || historyValue] as const;
}

export function resolveAndExecuteActionsWithContext(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  actions: AnyAction[]
): AnyMachineSnapshot {
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

          false;

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

    let actionParams = undefined;

    // Emitted events
    if (typeof action === 'object' && action !== null) {
      const { type: _, ...emittedEventParams } = action as any;
      actionParams = emittedEventParams;
    }

    if (resolvedAction && '_special' in resolvedAction) {
      const specialAction = resolvedAction as unknown as Action<
        any,
        any,
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
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : action.type
            : action.name || '(anonymous)',
        params: actionParams,
        args:
          typeof action === 'object' && 'action' in action ? action.args : [],
        exec: resolvedAction
      });
      continue;
    }
  }

  return intermediateSnapshot;
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
  let nextSnapshot = snapshot;
  const microstates: AnyMachineSnapshot[] = [];

  function addMicrostate(
    microstate: AnyMachineSnapshot,

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
      stopChildren(nextSnapshot, actorScope),
      {
        status: 'stopped'
      }
    );
    addMicrostate(nextSnapshot, []);

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
      addMicrostate(nextSnapshot, []);
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
    addMicrostate(nextSnapshot, transitions);
  }

  let shouldSelectEventlessTransitions = true;

  let microstepCount = 0;
  while (nextSnapshot.status === 'active') {
    microstepCount++;
    if (microstepCount > 1000) {
      throw new Error('Microstep count exceeded 1000');
    }
    let enabledTransitions: AnyTransitionDefinition[] =
      shouldSelectEventlessTransitions
        ? selectEventlessTransitions(nextSnapshot, nextEvent, actorScope)
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
    addMicrostate(nextSnapshot, enabledTransitions);
  }

  if (nextSnapshot.status !== 'active' && nextSnapshot.children) {
    stopChildren(nextSnapshot, actorScope);
  }

  return {
    snapshot: nextSnapshot,
    microstates
  };
}

function stopChildren(
  nextState: AnyMachineSnapshot,
  actorScope: AnyActorScope
) {
  let children;
  if (
    !nextState.children ||
    (children = Object.values(nextState.children).filter(Boolean)).length === 0
  ) {
    return nextState;
  }
  for (const child of children) {
    actorScope.stopChild(child);
  }
  return cloneMachineSnapshot(nextState, {
    children: {}
  });
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
  actorScope: AnyActorScope
): AnyTransitionDefinition[] {
  const enabledTransitionSet: Set<AnyTransitionDefinition> = new Set();
  const atomicStates = nextState._nodes.filter(isAtomicStateNode);

  for (const atomicStateNode of atomicStates) {
    loop: for (const stateNode of [atomicStateNode].concat(
      getProperAncestors(atomicStateNode, undefined)
    )) {
      if (!stateNode.always) {
        continue;
      }
      for (const transition of stateNode.always) {
        if (
          evaluateCandidate(
            transition,
            event,
            nextState,
            stateNode,
            actorScope.self
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
    nextState,
    event,
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
    listen: () => ({}) as any,
    subscribeTo: () => ({}) as any,
    ...props
  });

  return enqueueFn as any;
}

export const emptyEnqueueObject = createEnqueueObject({}, () => {});

function getActionsAndContextFromTransitionFn(
  action2: Action<any, any, any, any>,
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
): [
  actions: any[],
  context: MachineContext | undefined,
  internalEvents: EventObject[] | undefined
] {
  if (action2.length === 2) {
    // enqueue action; retrieve
    const actions: any[] = [];
    const internalEvents: EventObject[] = [];
    let updatedContext: MachineContext | undefined;

    const enqueue = createEnqueueObject(
      {
        cancel: (id: string) => {
          actions.push({
            action: builtInActions['@xstate.cancel'],
            args: [actorScope, id]
          });
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
          if (typeof raisedEvent === 'string') {
            throw new Error(
              `Only event objects may be used with raise; use raise({ type: "${raisedEvent}" }) instead`
            );
          }
          if (options?.delay !== undefined) {
            actions.push({
              action: builtInActions['@xstate.raise'],
              args: [actorScope, raisedEvent, options]
            });
          } else {
            internalEvents.push(raisedEvent);
          }
        },
        spawn: (logic, options) => {
          const actorRef = createActor(logic, { ...options, parent: self });
          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });
          return actorRef;
        },
        sendTo: (actorRef, event, options) => {
          if (actorRef) {
            actions.push({
              action: builtInActions['@xstate.sendTo'],
              args: [actorScope, actorRef, event, options]
            });
          }
        },
        stop: (actorRef) => {
          if (actorRef) {
            actions.push({
              action: builtInActions['@xstate.stopChild'],
              args: [actorScope, actorRef]
            });
          }
        },
        listen: (actor, eventType, mapper) => {
          const input: ListenerInput<any, any> = {
            actor,
            eventType,
            mapper
          };
          const actorRef = createActor(listenerLogic, {
            input,
            parent: self
          });
          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });
          return actorRef;
        },
        subscribeTo: (actor, mappers) => {
          // Handle shorthand: subscribeTo(actor, snapshotMapper)
          const normalizedMappers: SubscriptionMappers<any, any, any> =
            typeof mappers === 'function' ? { snapshot: mappers } : mappers;

          const input: SubscriptionInput<any, any, any, any> = {
            actor,
            mappers: normalizedMappers
          };
          const actorRef = createActor(subscriptionLogic, {
            input,
            parent: self
          });
          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });
          return actorRef;
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
        actors: machine.implementations.actors,
        guards: machine.implementations.guards,
        delays: machine.implementations.delays
      },
      enqueue
    );

    if (res?.context) {
      updatedContext = res.context;
    }

    return [actions, updatedContext, internalEvents];
  }

  return [[action2], undefined, undefined];
}

export function hasEffect(
  transition: AnyTransitionDefinition,
  context: MachineContext,
  event: EventObject,
  snapshot: AnyMachineSnapshot,
  self: AnyActorRef
): boolean {
  if (transition.to) {
    let hasEffect = false;
    let res;

    try {
      const triggerEffect = () => {
        hasEffect = true;
        throw new Error('Effect triggered');
      };
      res = transition.to(
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
          actors: snapshot.machine.implementations.actors,
          guards: snapshot.machine.implementations.guards,
          delays: snapshot.machine.implementations.delays
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
  candidate: AnyTransitionDefinition,
  event: EventObject,
  snapshot: AnyMachineSnapshot,
  stateNode: AnyStateNode,
  self: AnyActorRef
): boolean {
  if (candidate.to) {
    let hasEffect = false;
    let res;
    const context = snapshot.context;

    try {
      const triggerEffect = () => {
        hasEffect = true;
        throw new Error('Effect triggered');
      };
      res = candidate.to(
        {
          context,
          event,
          self,
          // @ts-ignore
          parent: {
            send: triggerEffect
          },
          value: snapshot.value,
          children: snapshot.children,
          actions: stateNode.machine.implementations.actions,
          actors: stateNode.machine.implementations.actors,
          guards: stateNode.machine.implementations.guards,
          delays: stateNode.machine.implementations.delays
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

  return true;
}
