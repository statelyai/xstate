import isDevelopment from '#is-development';
import { MachineSnapshot, cloneMachineSnapshot } from './State.ts';
import type { StateNode } from './StateNode.ts';
import {
  createAfterEvent,
  createDoneStateEvent,
  createInvokeTimeoutEvent,
  createTimeoutEvent
} from './eventUtils.ts';
import {
  XSTATE_INIT,
  STATE_DELIMITER,
  STATE_IDENTIFIER,
  XSTATE_STOP,
  NULL_EVENT
} from './constants.ts';
import { matchesEventDescriptor } from './utils.ts';
import {
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateNode,
  AnyTransitionDefinition,
  DelayedTransitionDefinition,
  EventObject,
  ExecutableActionObject,
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
  AnyActorRef,
  DoneStateEvent
} from './types.ts';
import {
  resolveOutput,
  normalizeTarget,
  toArray,
  toStatePath,
  isErrorActorEvent,
  resolveReferencedActor,
  toTransitionConfigArray
} from './utils.ts';
import { createActor } from './createActor.ts';
import { builtInActions } from './actions.ts';
import { listenerLogic, type ListenerInput } from './actors/listener.ts';
import {
  subscriptionLogic,
  type SubscriptionInput,
  type SubscriptionMappers
} from './actors/subscription.ts';
import { parseDurationToMilliseconds } from './delay.ts';

type AnyStateNodeIterable = Iterable<AnyStateNode>;

type AdjList = Map<AnyStateNode, Array<AnyStateNode>>;

function getConfiguredDelayValue(
  delay: number | string,
  delaySource: Record<string, any>
) {
  if (typeof delay !== 'string') {
    return delay;
  }

  const referencedDelay = delaySource[delay];
  if (referencedDelay !== undefined) {
    return referencedDelay;
  }

  return parseDurationToMilliseconds(delay) ?? delay;
}

function resolveDelay(
  delay: number | string | ((args: any) => number),
  delaySource: Record<string, any>,
  args: {
    context: MachineContext;
    event: EventObject;
    stateNode: AnyStateNode;
  }
) {
  if (typeof delay === 'function') {
    return delay(args);
  }

  const configuredDelay = getConfiguredDelayValue(delay, delaySource);
  if (typeof configuredDelay === 'function') {
    return configuredDelay(args);
  }

  return configuredDelay;
}

export function isAtomicStateNode(stateNode: AnyStateNode) {
  return (
    stateNode.type === 'atomic' ||
    stateNode.type === 'final' ||
    stateNode.type === 'choice'
  );
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
      for (const sn of getInitialStateNodes(s)) {
        nodeSet.add(sn);
      }
    } else {
      if (s.type === 'parallel') {
        for (const child of getChildren(s)) {
          if (child.type === 'history') {
            continue;
          }

          if (!nodeSet.has(child)) {
            const initialStates = getInitialStateNodes(child);
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
  const candidates = stateNode.transitions.get(receivedEventType);
  if (candidates) {
    return candidates;
  }

  const matchingDescriptors: string[] = [];

  for (const eventDescriptor of stateNode.transitions.keys()) {
    if (matchesEventDescriptor(receivedEventType, eventDescriptor)) {
      matchingDescriptors.push(eventDescriptor);
    }
  }

  matchingDescriptors.sort((a, b) => b.length - a.length);

  const wildcardCandidates: Array<TransitionDefinition<any, TEvent>> = [];
  for (const descriptor of matchingDescriptors) {
    wildcardCandidates.push(...stateNode.transitions.get(descriptor)!);
  }

  return wildcardCandidates;
}

export function mutateEntryExit(
  stateNode: AnyStateNode,
  entryFn?: (x: any, enq: EnqueueObject<any, any>) => void,
  exitFn?: (x: any, enq: EnqueueObject<any, any>) => void
) {
  if (entryFn) {
    const oldEntry = stateNode.entry;
    stateNode.entry = (x: any, enq: any) => {
      entryFn(x, enq);
      return typeof oldEntry === 'function' ? oldEntry(x, enq) : undefined;
    };
  }
  if (exitFn) {
    const oldExit = stateNode.exit;
    stateNode.exit = (x: any, enq: any) => {
      exitFn(x, enq);
      return typeof oldExit === 'function' ? oldExit(x, enq) : undefined;
    };
  }
  return stateNode;
}

function scheduleDelayedEvent(
  stateNode: AnyStateNode,
  event: AnyEventObject,
  resolveScheduledDelay: (x: {
    context: MachineContext;
    event: EventObject;
    delays: Record<string, any>;
  }) => any
) {
  const eventType = event.type;

  mutateEntryExit(
    stateNode,
    (x, enq) => {
      enq.raise(event as any, {
        id: eventType,
        delay: resolveScheduledDelay(x)
      });
    },
    (_, enq) => {
      enq.cancel(eventType);
    }
  );

  return eventType;
}

/** All delayed transitions from the config. */
export function getDelayedTransitions(
  stateNode: AnyStateNode
): Array<DelayedTransitionDefinition<MachineContext, EventObject>> {
  const afterConfig = stateNode.config.after;
  const timeoutConfig = (stateNode.config as any).timeout;
  const onTimeoutConfig = (stateNode.config as any).onTimeout;
  const invokeDefs = stateNode.invoke.filter(
    (invokeDef) => invokeDef.timeout !== undefined
  );

  if (!afterConfig && timeoutConfig === undefined && invokeDefs.length === 0) {
    return [];
  }

  if (isDevelopment && timeoutConfig !== undefined && !onTimeoutConfig) {
    throw new Error(
      `State "${stateNode.id}" has \`timeout\` but no \`onTimeout\` transition.`
    );
  }

  if (isDevelopment) {
    for (const invokeDef of invokeDefs) {
      if (!invokeDef.onTimeout) {
        throw new Error(
          `Invoke on state "${stateNode.id}" has \`timeout\` but no \`onTimeout\` transition.`
        );
      }
    }
  }

  const mutateEntryExitWithDelay = (delay: string | number) => {
    const afterEvent = createAfterEvent(delay, stateNode.id);
    return scheduleDelayedEvent(stateNode, afterEvent, (x) =>
      resolveDelay(delay, x.delays, {
        context: x.context,
        event: x.event,
        stateNode
      })
    );
  };

  const delayedTransitions: Array<
    AnyTransitionConfig & { event: string; delay: any }
  > = [];

  if (afterConfig) {
    for (const delay of Object.keys(afterConfig)) {
      const configTransition = afterConfig[delay];
      const parsedDelay = Number.isNaN(+delay) ? delay : +delay;
      const eventType = mutateEntryExitWithDelay(parsedDelay);
      const resolvedDelay = getConfiguredDelayValue(
        parsedDelay,
        stateNode.machine.implementations.delays
      );

      for (const transition of toTransitionConfigArray(
        configTransition as any
      )) {
        delayedTransitions.push({
          ...transition,
          event: eventType,
          delay: resolvedDelay
        });
      }
    }
  }

  // Desugar state-level `timeout` + `onTimeout` into a delayed transition.
  // Uses a dedicated `xstate.timeout.<id>` event so it cannot collide with
  // explicit `after` entries on the same state.
  if (timeoutConfig !== undefined && onTimeoutConfig) {
    const timeoutEvent = createTimeoutEvent(stateNode.id);
    const timeoutEventType = scheduleDelayedEvent(
      stateNode,
      timeoutEvent,
      (x) =>
        resolveDelay(timeoutConfig, x.delays, {
          context: x.context,
          event: x.event,
          stateNode
        }) as number
    );

    const resolvedDelay =
      typeof timeoutConfig === 'function'
        ? timeoutConfig
        : getConfiguredDelayValue(
            timeoutConfig,
            stateNode.machine.implementations.delays
          );

    for (const transition of toTransitionConfigArray(onTimeoutConfig as any)) {
      delayedTransitions.push({
        ...transition,
        event: timeoutEventType,
        delay: resolvedDelay
      });
    }
  }

  // Desugar invoke-level `timeout` + `onTimeout` into a delayed transition on
  // the enclosing state. Completion transitions cancel this timer separately,
  // so the timeout is cleared even when the parent state stays active.
  for (const invokeDef of invokeDefs) {
    const invokeTimeoutEvent = createInvokeTimeoutEvent(invokeDef.id);
    const invokeTimeout = invokeDef.timeout!;
    const invokeTimeoutEventType = scheduleDelayedEvent(
      stateNode,
      invokeTimeoutEvent,
      (x) =>
        resolveDelay(
          invokeTimeout,
          {},
          {
            context: x.context,
            event: x.event,
            stateNode
          }
        ) as number
    );

    const invokeOnTimeout = invokeDef.onTimeout;
    for (const transition of toTransitionConfigArray(invokeOnTimeout as any)) {
      delayedTransitions.push({
        ...transition,
        event: invokeTimeoutEventType,
        delay: invokeTimeout as any
      });
    }
  }

  const formattedDelayedTransitions: Array<
    DelayedTransitionDefinition<MachineContext, EventObject>
  > = [];

  for (let i = 0; i < delayedTransitions.length; i++) {
    const delayedTransition = delayedTransitions[i];
    const { delay } = delayedTransition;
    formattedDelayedTransitions.push({
      ...formatTransition(
        stateNode,
        delayedTransition.event,
        delayedTransition as AnyTransitionConfig
      ),
      delay
    });
  }

  return formattedDelayedTransitions;
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
  const formatTransitionConfigs = (
    descriptor: string,
    transitionsConfig: unknown
  ) =>
    toTransitionConfigArray(transitionsConfig as any).map((t) =>
      formatTransition(stateNode, descriptor, t)
    );
  if (stateNode.config.on) {
    for (const descriptor of Object.keys(stateNode.config.on)) {
      if (descriptor === NULL_EVENT) {
        throw new Error(
          'Null events ("") cannot be specified as a transition key. Use `always: { ... }` instead.'
        );
      }
      transitions.set(
        descriptor,
        formatTransitionConfigs(descriptor, stateNode.config.on[descriptor])
      );
    }
  }
  if (stateNode.config.onDone) {
    const descriptor = `xstate.done.state.${stateNode.id}`;
    transitions.set(
      descriptor,
      formatTransitionConfigs(descriptor, stateNode.config.onDone)
    );
  }
  for (const invokeDef of stateNode.invoke) {
    if (invokeDef.onDone) {
      const descriptor = `xstate.done.actor.${invokeDef.id}`;
      transitions.set(
        descriptor,
        formatTransitionConfigs(descriptor, invokeDef.onDone)
      );
    }
    if (invokeDef.onError) {
      const descriptor = `xstate.error.actor.${invokeDef.id}`;
      transitions.set(
        descriptor,
        formatTransitionConfigs(descriptor, invokeDef.onError)
      );
    }
    if (invokeDef.onSnapshot) {
      const descriptor = `xstate.snapshot.${invokeDef.id}`;
      transitions.set(
        descriptor,
        formatTransitionConfigs(descriptor, invokeDef.onSnapshot)
      );
    }
  }
  for (const delayedTransition of stateNode.after) {
    let existing = transitions.get(delayedTransition.eventType);
    if (!existing) {
      existing = [];
      transitions.set(delayedTransition.eventType, existing);
    }
    existing.push(
      delayedTransition as TransitionDefinition<TContext, AnyEventObject>
    );
  }
  return transitions as Map<string, TransitionDefinition<TContext, any>[]>;
}

/**
 * Collects route transitions from all descendants with explicit IDs. Called
 * once on the root node to avoid O(N²) repeated traversals.
 */
export function formatRouteTransitions(rootStateNode: AnyStateNode): void {
  const routeTransitions: AnyTransitionDefinition[] = [];
  const collectRoutes = (states: Record<string, AnyStateNode>) => {
    Object.values(states).forEach((sn) => {
      if (sn.config.route && sn.config.id) {
        const routeId = sn.config.id;
        const userGuard = sn.config.route.guard;
        const routeGuard = (
          args: { context: any; event: any },
          params: any
        ) => {
          if (args.event.to !== `#${routeId}`) {
            return false;
          }
          if (!userGuard) {
            return true;
          }
          if (typeof userGuard === 'function') {
            return userGuard(args, params);
          }
          return true;
        };
        const transition: AnyTransitionConfig = {
          ...sn.config.route,
          guard: routeGuard,
          target: `#${routeId}`
        };

        routeTransitions.push(
          formatTransition(rootStateNode, 'xstate.route', transition)
        );
      }
      if (sn.states) {
        collectRoutes(sn.states);
      }
    });
  };
  collectRoutes(rootStateNode.states);
  if (routeTransitions.length > 0) {
    rootStateNode.transitions.set('xstate.route', routeTransitions as any);
  }
}

export function formatInitialTransition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
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
    return stateNode.parent!.initial as AnyTransitionDefinition;
  }
  return {
    target: normalizedTarget.map((t) =>
      typeof t === 'string' ? getStateNodeByPath(stateNode.parent!, t) : t
    ),
    source: stateNode,
    reenter: false,
    eventType: '' as any
  };
}

function isHistoryNode(
  stateNode: AnyStateNode
): stateNode is AnyStateNode & { type: 'history' } {
  return stateNode.type === 'history';
}

function getInitialStateNodes(stateNode: AnyStateNode) {
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
  for (const initialState of set) {
    for (const ancestor of getProperAncestors(initialState, stateNode)) {
      set.add(ancestor);
    }
  }

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
  const childStateNodes = new Array<AnyStateNode>(childStateKeys.length);
  const allStateNodes: Array<AnyStateNode> = [
    stateNode.machine.root,
    stateNode
  ];

  for (let i = 0; i < childStateKeys.length; i++) {
    const subStateNode = getStateNode(stateNode, childStateKeys[i]);
    childStateNodes[i] = subStateNode;
    allStateNodes.push(subStateNode);
  }

  for (let i = 0; i < childStateKeys.length; i++) {
    allStateNodes.push(
      ...getStateNodes(childStateNodes[i], stateValue[childStateKeys[i]]!)
    );
  }

  return allStateNodes;
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
  subStateKey: string,
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
  const childStateNode = getStateNode(stateNode, subStateKey);
  const next = transitionNode(
    childStateNode,
    stateValue[subStateKey]!,
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

  const subStateKeys = Object.keys(stateValue);
  const subStateKey = subStateKeys[0];

  if (subStateKeys.length === 1) {
    return transitionCompoundNode(
      stateNode,
      stateValue,
      subStateKey,
      snapshot,
      event,
      self
    );
  }

  return transitionParallelNode(stateNode, stateValue, snapshot, event, self);
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

function hasDescendantState(
  stateNodes: Set<AnyStateNode>,
  parentStateNode: AnyStateNode
): boolean {
  for (const stateNode of stateNodes) {
    if (isDescendant(stateNode, parentStateNode)) {
      return true;
    }
  }

  return false;
}

function hasIntersection<T>(s1: Iterable<T>, s2: Iterable<T>): boolean {
  const s1Size =
    s1 instanceof Set ? s1.size : Array.isArray(s1) ? s1.length : undefined;
  const s2Size =
    s2 instanceof Set ? s2.size : Array.isArray(s2) ? s2.length : undefined;

  if (s1Size !== undefined && s2Size !== undefined && s2Size < s1Size) {
    [s1, s2] = [s2, s1];
  }

  const set1 = s1 instanceof Set ? s1 : new Set(s1);
  for (const item of s2) {
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
  const exitSets = new Map<AnyTransitionDefinition, Array<AnyStateNode>>();

  const getExitSet = (transition: AnyTransitionDefinition) => {
    let exitSet = exitSets.get(transition);
    if (!exitSet) {
      exitSet = computeExitSet(
        [transition],
        stateNodeSet,
        snapshot,
        event,
        actorScope
      );
      exitSets.set(transition, exitSet);
    }

    return exitSet;
  };

  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = new Set<AnyTransitionDefinition>();
    for (const t2 of filteredTransitions) {
      if (hasIntersection(getExitSet(t1), getExitSet(t2))) {
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

type Microstep = readonly [AnyMachineSnapshot, ExecutableActionObject[]];

export function initialMicrostep(
  root: AnyStateNode,
  preInitialState: AnyMachineSnapshot,
  actorScope: AnyActorScope,
  initEvent: AnyEventObject,
  internalQueue: AnyEventObject[]
): Microstep {
  return microstep(
    [
      {
        target: [...getInitialStateNodes(root)],
        source: root,
        reenter: true,
        eventType: null as any,
        toJSON: null as any
      } as AnyTransitionDefinition
    ],
    preInitialState,
    actorScope,
    initEvent,
    true,
    internalQueue
  );
}

/** https://www.w3.org/TR/scxml/#microstepProcedure */
function microstep(
  transitions: Array<AnyTransitionDefinition>,
  currentSnapshot: AnyMachineSnapshot,
  actorScope: AnyActorScope,
  event: AnyEventObject,
  isInitial: boolean,
  internalQueue: Array<AnyEventObject>
): Microstep {
  const actions: ExecutableActionObject[] = [];

  if (!transitions.length) {
    return [currentSnapshot, actions];
  }

  const originalExecutor = actorScope.actionExecutor;
  actorScope.actionExecutor = (action) => {
    actions.push(action);
    originalExecutor(action);
  };

  try {
    const mutStateNodeSet = new Set(currentSnapshot._nodes as StateNode[]);
    let historyValue = currentSnapshot.historyValue;
    const originalContext = currentSnapshot.context;

    const filteredTransitions = removeConflictingTransitions(
      transitions,
      mutStateNodeSet,
      currentSnapshot,
      event,
      actorScope
    );
    const getCurrentTransitionResult = (
      transition: Parameters<typeof getTransitionResult>[0]
    ) => getTransitionResult(transition, currentSnapshot, event, actorScope);
    const getStateActionsAndContext = (
      transitionFn: any,
      context: MachineContext,
      children: AnyMachineSnapshot['children'],
      input: Record<string, unknown> | undefined
    ) =>
      getActionsAndContextFromTransitionFn(transitionFn, {
        context,
        event,
        self: actorScope.self,
        parent: actorScope.self._parent,
        children,
        actorScope,
        machine: currentSnapshot.machine,
        input
      });

    let nextState = currentSnapshot;
    const exitStates = () => {
      const statesToExit = computeExitSet(
        filteredTransitions,
        mutStateNodeSet,
        currentSnapshot,
        event,
        actorScope
      );

      statesToExit.sort((a, b) => b.order - a.order);

      let changedHistory: HistoryValue | undefined;
      const currentStateNodes = [...mutStateNodeSet];

      // From SCXML algorithm: https://www.w3.org/TR/scxml/#exitStates
      for (const exitStateNode of statesToExit) {
        for (const historyNode of Object.values(exitStateNode.states)) {
          if (historyNode.type !== 'history') {
            continue;
          }

          const predicate =
            historyNode.history === 'deep'
              ? (sn: AnyStateNode) =>
                  isAtomicStateNode(sn) && isDescendant(sn, exitStateNode)
              : (sn: AnyStateNode) => sn.parent === exitStateNode;

          changedHistory ??= { ...historyValue };
          changedHistory[historyNode.id] = currentStateNodes.filter(predicate);
        }
      }

      for (const exitStateNode of statesToExit) {
        const stateInput = currentSnapshot._stateInputs?.[exitStateNode.id];

        const [exitActions, nextContext, internalEvents] = exitStateNode.exit
          ? getStateActionsAndContext(
              exitStateNode.exit,
              nextState.context,
              currentSnapshot.children,
              stateInput
            )
          : [[]];
        if (internalEvents?.length) {
          internalQueue.push(...internalEvents);
        }
        if (nextContext) {
          nextState = cloneMachineSnapshot(nextState, {
            context: nextContext
          });
        }
        nextState = resolveAndExecuteActionsWithContext(
          nextState,
          event,
          actorScope,
          exitActions
        );
        for (const def of exitStateNode.invoke) {
          const childActor = nextState.children[def.id];
          if (childActor && !childActor._isExternal) {
            actorScope.stopChild(childActor);
          }
          delete nextState.children[def.id];
        }

        mutStateNodeSet.delete(exitStateNode);
      }

      historyValue = changedHistory || historyValue;
    };

    // Exit states
    if (!isInitial) {
      exitStates();
    }

    let context = nextState.context;
    const transitionActions: AnyAction[] = [];
    const internalEvents: EventObject[] = [];

    for (const t of filteredTransitions) {
      if (t.actions) {
        transitionActions.push(...toArray(t.actions));
      }
      const res = getCurrentTransitionResult(t);
      if (res.context) {
        context = res.context;
      }
      if (res.actions) {
        transitionActions.push(...res.actions);
      }
      if (res.internalEvents) {
        internalEvents.push(...res.internalEvents);
      }
    }

    if (internalEvents.length) {
      internalQueue.push(...internalEvents);
    }

    const enterStates = () => {
      const getMachineOutput = (rootCompletionNode: AnyStateNode) => {
        const rootNode = nextState.machine.root;
        if (rootNode.output === undefined) {
          return;
        }

        let completionOutput: unknown;
        if (
          rootCompletionNode.output !== undefined &&
          rootCompletionNode.parent
        ) {
          completionOutput = resolveOutput(
            rootCompletionNode.output,
            nextState.context,
            event,
            actorScope.self
          );
        } else if (rootCompletionNode.type === 'parallel') {
          const parallelDoneType = `xstate.done.state.${rootCompletionNode.id}`;
          const parallelDoneEvent = internalQueue.find(
            (e) => e.type === parallelDoneType
          ) as DoneStateEvent | undefined;
          completionOutput = parallelDoneEvent?.output;
        }

        return resolveOutput(
          rootNode.output,
          nextState.context,
          createDoneStateEvent(rootCompletionNode.id, completionOutput),
          actorScope.self
        );
      };

      const statesToEnter = new Set<AnyStateNode>();
      // those are states that were directly targeted or indirectly targeted by the explicit target
      // in other words, those are states for which initial actions should be executed
      // when we target `#deep_child` initial actions of its ancestors shouldn't be executed
      const statesForDefaultEntry = new Set<AnyStateNode>();
      const addAncestorStatesToEnter = (
        ancestors: AnyStateNode[],
        reentrancyDomain: AnyStateNode | undefined
      ) => {
        for (const anc of ancestors) {
          if (!reentrancyDomain || isDescendant(anc, reentrancyDomain)) {
            statesToEnter.add(anc);
          }
          if (anc.type === 'parallel') {
            for (const child of getChildren(anc)) {
              if (!hasDescendantState(statesToEnter, child)) {
                statesToEnter.add(child);
                addDescendantStatesToEnter(child);
              }
            }
          }
        }
      };

      const addProperAncestorStatesToEnter = (
        stateNode: AnyStateNode,
        toStateNode: AnyStateNode | undefined
      ) => {
        addAncestorStatesToEnter(
          getProperAncestors(stateNode, toStateNode),
          undefined
        );
      };

      const addDescendantStatesToEnter = (stateNode: AnyStateNode) => {
        if (isHistoryNode(stateNode)) {
          if (historyValue[stateNode.id]) {
            const historyStateNodes = historyValue[stateNode.id];
            for (const s of historyStateNodes) {
              statesToEnter.add(s);
              addDescendantStatesToEnter(s);
            }
            for (const s of historyStateNodes) {
              addProperAncestorStatesToEnter(s, stateNode.parent);
            }
          } else {
            const historyDefaultTransition =
              resolveHistoryDefaultTransition(stateNode);
            const { targets } = getCurrentTransitionResult(
              historyDefaultTransition
            );
            for (const s of targets ?? []) {
              statesToEnter.add(s);

              if (historyDefaultTransition === stateNode.parent?.initial) {
                statesForDefaultEntry.add(stateNode.parent);
              }

              addDescendantStatesToEnter(s);
            }

            for (const s of targets ?? []) {
              addProperAncestorStatesToEnter(s, stateNode.parent);
            }
          }
          return;
        }

        if (stateNode.type === 'compound') {
          const [initialState] = getCurrentTransitionResult(
            stateNode.initial
          ).targets!;

          if (!isHistoryNode(initialState)) {
            statesToEnter.add(initialState);
            statesForDefaultEntry.add(initialState);
          }
          addDescendantStatesToEnter(initialState);
          addProperAncestorStatesToEnter(initialState, stateNode);
          return;
        }

        if (stateNode.type === 'parallel') {
          for (const child of getChildren(stateNode)) {
            if (!hasDescendantState(statesToEnter, child)) {
              statesToEnter.add(child);
              statesForDefaultEntry.add(child);
              addDescendantStatesToEnter(child);
            }
          }
        }
      };

      for (const transition of filteredTransitions) {
        const domain = getTransitionDomain(
          transition,
          currentSnapshot,
          event,
          actorScope
        );

        const { targets, reenter } = getCurrentTransitionResult(transition);

        for (const targetNode of targets ?? []) {
          if (
            !isHistoryNode(targetNode) &&
            (transition.source !== targetNode ||
              transition.source !== domain ||
              reenter)
          ) {
            statesToEnter.add(targetNode);
            statesForDefaultEntry.add(targetNode);
          }
          addDescendantStatesToEnter(targetNode);
        }
        const targetStates = getEffectiveTargetStates(
          transition,
          currentSnapshot,
          event,
          actorScope
        );
        for (const s of targetStates) {
          const ancestors = getProperAncestors(s, domain);
          if (domain?.type === 'parallel') {
            ancestors.push(domain);
          }
          addAncestorStatesToEnter(
            ancestors,
            !transition.source.parent && reenter ? undefined : domain
          );
        }
      }

      if (isInitial) {
        statesForDefaultEntry.add(currentSnapshot.machine.root);
      }

      const stateInputMap: Record<string, Record<string, unknown>> = {
        ...currentSnapshot._stateInputs
      };
      for (const transition of filteredTransitions) {
        const { targets, input } = getCurrentTransitionResult(transition);
        if (input && targets) {
          for (const targetNode of targets) {
            stateInputMap[targetNode.id] = input;
          }
        }
      }

      const completedNodes = new Set<AnyStateNode>();
      const children = { ...currentSnapshot.children };
      let invoked = false;
      for (const stateNodeToEnter of [...statesToEnter].sort(
        (a, b) => a.order - b.order
      )) {
        mutStateNodeSet.add(stateNodeToEnter);
        const actions: AnyAction[] = [];

        for (const invokeDef of stateNodeToEnter.invoke) {
          invoked = true;

          let src = invokeDef.logic;
          if (typeof src === 'function') {
            src = src({
              actors: currentSnapshot.machine.implementations.actors,
              context: currentSnapshot.context,
              event,
              self: actorScope.self
            });
          }

          const logic =
            typeof src === 'string'
              ? resolveReferencedActor(currentSnapshot.machine, src)
              : src;

          if (!logic) {
            throw new Error(
              `Actor logic '${src}' not implemented in machine '${currentSnapshot.machine.id}'`
            );
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

          actions.push({
            action: builtInActions['@xstate.start'],
            args: [actorRef]
          });

          if (invokeDef.id) {
            children[invokeDef.id] = actorRef;
          }
        }

        if (invoked) {
          nextState = cloneMachineSnapshot(nextState, { children });
        }
        let context: MachineContext | undefined;

        const stateInput = stateInputMap[stateNodeToEnter.id];

        if (stateNodeToEnter.entry) {
          const [resultActions, nextContext, nextInternalEvents] =
            getStateActionsAndContext(
              stateNodeToEnter.entry,
              nextState.context,
              children,
              stateInput
            );
          actions.push(...resultActions);
          if (nextInternalEvents?.length) {
            internalQueue.push(...nextInternalEvents);
          }
          if (nextContext) {
            context = nextContext;
          }
        }

        if (statesForDefaultEntry.has(stateNodeToEnter)) {
          const { actions: initialActions, input: initialInput } =
            getTransitionResult(
              stateNodeToEnter.initial,
              nextState,
              event,
              actorScope
            );
          if (initialActions) {
            actions.push(...initialActions);
          }
          if (initialInput && stateNodeToEnter.initial?.target) {
            for (const targetNode of stateNodeToEnter.initial.target) {
              stateInputMap[targetNode.id] = initialInput;
            }
          }
        }

        nextState = resolveAndExecuteActionsWithContext(
          nextState,
          event,
          actorScope,
          actions
        );

        if (context) {
          nextState.context = context;
        }

        if (stateNodeToEnter.type !== 'final') {
          continue;
        }

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
          const regionOutput: Record<string, unknown> = {};
          for (const region of getChildren(ancestorMarker)) {
            if (region.type === 'final') {
              regionOutput[region.key] =
                region.output !== undefined
                  ? resolveOutput(
                      region.output,
                      nextState.context,
                      event,
                      actorScope.self
                    )
                  : undefined;
              continue;
            }

            if (region.type === 'parallel') {
              const regionDoneType = `xstate.done.state.${region.id}`;
              const regionDoneEvent = internalQueue.find(
                (e) => e.type === regionDoneType
              ) as DoneStateEvent | undefined;
              regionOutput[region.key] = regionDoneEvent?.output;
              continue;
            }

            const finalChild = getChildren(region).find(
              (s) => s.type === 'final' && mutStateNodeSet.has(s)
            );
            regionOutput[region.key] =
              finalChild?.output !== undefined
                ? resolveOutput(
                    finalChild.output,
                    nextState.context,
                    event,
                    actorScope.self
                  )
                : undefined;
          }
          internalQueue.push(
            createDoneStateEvent(ancestorMarker.id, regionOutput)
          );
          rootCompletionNode = ancestorMarker;
          ancestorMarker = ancestorMarker.parent;
        }
        if (ancestorMarker) {
          continue;
        }

        nextState = cloneMachineSnapshot(nextState, {
          status: 'done',
          output: getMachineOutput(rootCompletionNode)
        });
      }

      const inputChanged =
        JSON.stringify(stateInputMap) !==
        JSON.stringify(currentSnapshot._stateInputs || {});
      if (inputChanged) {
        nextState = cloneMachineSnapshot(nextState, {
          _stateInputs: stateInputMap
        });
      }
    };

    // Execute transition content
    nextState = resolveAndExecuteActionsWithContext(
      nextState,
      event,
      actorScope,
      transitionActions
    );
    if (context && context !== currentSnapshot.context) {
      nextState = cloneMachineSnapshot(nextState, { context });
    }

    // Enter states
    enterStates();

    const nextStateNodes = [...mutStateNodeSet];

    if (nextState.status === 'done') {
      const allExitActions: AnyAction[] = [];
      const nextStateNodesToExit = nextStateNodes.sort(
        (a, b) => b.order - a.order
      );

      nextStateNodesToExit.forEach((stateNode) => {
        if (stateNode.exit) {
          const stateInput = nextState._stateInputs?.[stateNode.id];
          const [exitActions, , nextInternalEvents] = getStateActionsAndContext(
            stateNode.exit,
            nextState.context,
            nextState.children,
            stateInput
          );
          allExitActions.push(...exitActions);
          if (nextInternalEvents?.length) {
            internalQueue.push(...nextInternalEvents);
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

    if (
      historyValue === currentSnapshot.historyValue &&
      currentSnapshot._nodes.length === mutStateNodeSet.size &&
      currentSnapshot._nodes.every((node) =>
        mutStateNodeSet.has(node as StateNode)
      )
    ) {
      // If context was changed (e.g. by entry actions during self-transition),
      // clone to ensure reference inequality for eventless transition re-evaluation
      if (nextState.context !== originalContext) {
        return [cloneMachineSnapshot(nextState), actions];
      }
      return [nextState, actions];
    }

    return [
      cloneMachineSnapshot(nextState, {
        _nodes: nextStateNodes,
        historyValue
      }),
      actions
    ];
  } finally {
    actorScope.actionExecutor = originalExecutor;
  }
}

/**
 * Gets the transition result for a given transition without executing the
 * transition.
 */
export function getTransitionResult(
  transition: Pick<AnyTransitionDefinition, 'target' | 'to' | 'source'> & {
    reenter?: AnyTransitionDefinition['reenter'];
    input?: AnyTransitionDefinition['input'];
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
  input: Record<string, unknown> | undefined;
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
      ? resolveTarget(transition.source, toArray(res.target) as string[])
      : undefined;
    // Resolve input for .to transitions
    const resolvedInput =
      typeof transition.input === 'function'
        ? transition.input({ context: snapshot.context, event })
        : transition.input;

    return {
      targets: targets,
      context: res?.context,
      reenter: res?.reenter,
      actions,
      internalEvents,
      input: resolvedInput
    };
  }

  // Resolve input for regular transitions
  const resolvedInput =
    typeof transition.input === 'function'
      ? transition.input({ context: snapshot.context, event })
      : transition.input;

  return {
    targets: transition.target as AnyStateNode[] | undefined,
    context: undefined,
    reenter: transition.reenter,
    actions: undefined,
    internalEvents: undefined,
    input: resolvedInput
  };
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
      actorScope.actionExecutor({
        type:
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : ((action as any).type ?? '(anonymous)')
            : action.name || '(anonymous)',
        params: actionParams,
        args: [],
        exec: undefined
      });

      const specialAction = resolvedAction as unknown as Action<
        any,
        any,
        any,
        any,
        any,
        any,
        any
      >;

      const res = specialAction(actionArgs as any, emptyEnqueueObject);

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
              : (action as AnyEventObject).type
            : (action as Function).name || '(anonymous)',
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
  microsteps: Microstep[];
} {
  let nextSnapshot = snapshot;
  const microsteps: Microstep[] = [];

  function addMicrostep(
    step: Microstep,
    event: AnyEventObject,
    transitions: AnyTransitionDefinition[]
  ) {
    // collect microsteps for unified '@xstate.transition'
    (actorScope.self as any)._collectedMicrosteps = [
      ...(((actorScope.self as any)._collectedMicrosteps as any[]) || []),
      ...transitions
    ];
    actorScope.system._sendInspectionEvent({
      type: '@xstate.microstep',
      actorRef: actorScope.self,
      event,
      snapshot: step[0],
      _transitions: transitions
    });
    microsteps.push(step);
  }

  const stopChildren = (snapshot: AnyMachineSnapshot) => {
    let children: AnyActorRef[];
    if (
      !snapshot.children ||
      (children = Object.values(snapshot.children).filter(
        Boolean
      ) as AnyActorRef[]).length === 0
    ) {
      return snapshot;
    }
    for (const child of children) {
      actorScope.stopChild(child);
    }
    return cloneMachineSnapshot(snapshot, {
      children: {}
    });
  };

  const selectEventlessTransitions = (
    snapshot: AnyMachineSnapshot,
    event: AnyEventObject
  ) => {
    const enabledTransitionSet: Set<AnyTransitionDefinition> = new Set();
    const atomicStates = snapshot._nodes.filter(isAtomicStateNode);

    for (const atomicStateNode of atomicStates) {
      loop: for (
        let stateNode: AnyStateNode | undefined = atomicStateNode;
        stateNode;
        stateNode = stateNode.parent
      ) {
        if (!stateNode.always) {
          continue;
        }
        for (const transition of stateNode.always) {
          if (
            evaluateCandidate(
              transition,
              event,
              snapshot,
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
      new Set(snapshot._nodes),
      snapshot,
      event,
      actorScope
    );
  };

  // Handle stop event
  if (event.type === XSTATE_STOP) {
    nextSnapshot = cloneMachineSnapshot(stopChildren(nextSnapshot), {
      status: 'stopped'
    });
    addMicrostep([nextSnapshot, []], event, []);
    return {
      snapshot: nextSnapshot,
      microsteps
    };
  }

  let nextEvent = event;

  // Assume the state is at rest (no raised events)
  // Determine the next state based on the next microstep
  if (nextEvent.type !== XSTATE_INIT) {
    const currentEvent = nextEvent;
    const isErr = isErrorActorEvent(currentEvent);

    const transitions = nextSnapshot.machine.getTransitionData(
      nextSnapshot as any,
      currentEvent,
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
      addMicrostep([nextSnapshot, []], currentEvent, []);
      return {
        snapshot: nextSnapshot,
        microsteps
      };
    }
    const step = microstep(
      transitions,
      snapshot,
      actorScope,
      nextEvent,
      false, // isInitial
      internalQueue
    );
    nextSnapshot = step[0];
    addMicrostep(step, currentEvent, transitions);
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
        ? selectEventlessTransitions(nextSnapshot, nextEvent)
        : [];

    // eventless transitions should always be selected after selecting *regular* transitions
    // by assigning `undefined` to `previousState` we ensure that `shouldSelectEventlessTransitions` gets always computed to true in such a case
    const previousState = enabledTransitions.length ? nextSnapshot : undefined;

    if (!enabledTransitions.length) {
      if (!internalQueue.length) {
        break;
      }
      nextEvent = internalQueue.shift()!;
      enabledTransitions = nextSnapshot.machine.getTransitionData(
        nextSnapshot as any,
        nextEvent,
        actorScope.self
      );
    }

    const step = microstep(
      enabledTransitions,
      nextSnapshot,
      actorScope,
      nextEvent,
      false,
      internalQueue
    );
    nextSnapshot = step[0];
    shouldSelectEventlessTransitions = nextSnapshot !== previousState;
    addMicrostep(step, nextEvent, enabledTransitions);
  }

  if (nextSnapshot.status !== 'active' && nextSnapshot.children) {
    stopChildren(nextSnapshot);
  }

  return {
    snapshot: nextSnapshot,
    microsteps
  };
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
  return getStateValue(rootNode, allStateNodes);
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
  action2: ((args: any, enqueue: any) => any) & { _special?: boolean },
  {
    context,
    event,
    parent,
    self,
    children,
    actorScope,
    machine,
    input
  }: {
    context: MachineContext;
    event: EventObject;
    self: AnyActorRef;
    parent: AnyActorRef | undefined;
    children: Record<string, AnyActorRef>;
    actorScope: AnyActorScope;
    machine: AnyStateMachine;
    input?: Record<string, unknown>;
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
        delays: machine.implementations.delays,
        input
      },
      enqueue
    );

    if (res?.context) {
      updatedContext = res.context;
    }

    return [actions, updatedContext, internalEvents];
  }

  // For 1-argument actions, wrap them to include input
  // Preserve _special flag if present (for entry/exit actions)
  const wrappedAction = Object.assign(
    (args: any, enqueue: any) => (action2 as any)({ ...args, input }, enqueue),
    '_special' in (action2 as any) ? { _special: true } : {}
  );
  return [[wrappedAction], undefined, undefined];
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
  if (candidate.guard) {
    const guardArgs = {
      context: snapshot.context,
      event,
      self,
      parent: self._parent,
      children: snapshot.children,
      actions: stateNode.machine.implementations.actions,
      actors: stateNode.machine.implementations.actors,
      guards: stateNode.machine.implementations.guards,
      delays: stateNode.machine.implementations.delays
    };
    const guardConfig = candidate.guard as any;
    const guardParams =
      typeof guardConfig?.params === 'function'
        ? guardConfig.params({ context: snapshot.context, event })
        : guardConfig?.params;

    let guardPassed = true;
    if (typeof guardConfig === 'function') {
      guardPassed = guardConfig(guardArgs, guardParams);
    } else if (typeof guardConfig?.type === 'string') {
      const guardImpl =
        stateNode.machine.implementations.guards[guardConfig.type];
      guardPassed = guardImpl ? guardImpl(guardArgs, guardParams) : true;
    }

    if (!guardPassed) {
      return false;
    }
  }

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
