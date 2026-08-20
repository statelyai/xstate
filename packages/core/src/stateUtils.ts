import { isRemoteActorRef } from './remoteActorRef.ts';
import isDevelopment from '#is-development';
import { MachineSnapshot, cloneMachineSnapshot } from './State.ts';
import type { StateNode } from './StateNode.ts';
import {
  createAfterEvent,
  createAfterEventId,
  createDoneStateEvent,
  createInvokeTimeoutEvent,
  createInvokeTimeoutEventId,
  createTimeoutEvent,
  createTimeoutEventId
} from './eventUtils.ts';
import {
  XSTATE_INIT,
  STATE_DELIMITER,
  STATE_IDENTIFIER,
  XSTATE_STOP,
  XSTATE_TIMER
} from './constants.ts';
import {
  getEventOutput,
  isErrorEvent,
  matchesEvent,
  matchesEventDescriptor
} from './utils.ts';
import {
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  AnyStateNode,
  AnyTransitionDefinition,
  DelayedTransitionDefinition,
  EventObject,
  ExecutableActionObject,
  HistoryValue,
  MachineContext,
  StateValue,
  TransitionDefinition,
  AnyAction,
  AnyTransitionConfig,
  AnyActor,
  AnyActorScope,
  DoneStateEvent
} from './types.ts';
import {
  resolveOutput,
  normalizeTarget,
  toArray,
  toStatePath,
  resolveReferencedActor,
  toTransitionConfigArray
} from './utils.ts';
import { builtInActions } from './actions.ts';
import {
  assertChildIdFree,
  createEnqueueObject,
  createTerminationEffect,
  createTransitionEnqueue,
  createSendToEffect,
  deriveDeferredStarts,
  mergeContextPatch,
  resolveActionsWithContext
} from './transitionActions.ts';
import { parseDurationToMilliseconds } from './delay.ts';
import { transitionEffectSignal, transitionEffectTargets } from './system.ts';
import { isInertActorScope } from './getNextSnapshot.ts';
import {
  getActorScopeParent,
  isLazyActorScope,
  withActorSelfAndParent,
  withActorScope
} from './actorScope.ts';

type AnyStateNodeIterable = Iterable<AnyStateNode>;

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
    input?: Record<string, unknown>;
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

function getStateInput(snapshot: AnyMachineSnapshot, stateNodeId: string) {
  return snapshot._stateInputs?.[stateNodeId];
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
  const activeParentSet = new Set<AnyStateNode>();
  for (const stateNode of nodeSet) {
    if (stateNode.parent) {
      activeParentSet.add(stateNode.parent);
    }
  }

  // add descendants
  for (const s of nodeSet) {
    // if previously active, add existing child nodes
    if (s.type === 'compound' && !activeParentSet.has(s)) {
      for (const sn of getInitialStateNodes(s)) {
        nodeSet.add(sn);
      }
      continue;
    }

    if (s.type === 'parallel') {
      for (const child of getChildren(s)) {
        if (!nodeSet.has(child)) {
          const initialStates = getInitialStateNodes(child);
          for (const initialStateNode of initialStates) {
            nodeSet.add(initialStateNode);
          }
        }
      }
    }
  }

  // add all ancestors
  // Stop walking up as soon as we hit a node already in the set: its own
  // ancestor chain is guaranteed to be added when it is visited by this loop
  // (Set iteration visits elements added during iteration), so shared ancestor
  // chains are never re-walked once per descendant.
  for (const s of nodeSet) {
    let m = s.parent;

    while (m && !nodeSet.has(m)) {
      nodeSet.add(m);
      m = m.parent;
    }
  }

  return nodeSet;
}

export function getStateValue(
  rootNode: AnyStateNode,
  stateNodes: AnyStateNodeIterable
): StateValue {
  const config = getAllStateNodes(stateNodes);
  const adjList = new Map<AnyStateNode, Array<AnyStateNode>>();

  for (const s of config) {
    if (!adjList.has(s)) {
      adjList.set(s, []);
    }

    if (!s.parent) {
      continue;
    }

    if (!adjList.has(s.parent)) {
      adjList.set(s.parent, []);
    }

    adjList.get(s.parent)!.push(s);
  }

  const getValueFromAdj = (baseNode: AnyStateNode): StateValue => {
    const childStateNodes = adjList.get(baseNode);

    if (!childStateNodes) {
      return {}; // todo: fix?
    }

    if (baseNode.type === 'compound') {
      const childStateNode = childStateNodes[0];
      if (!childStateNode) {
        return {};
      }
      if (isAtomicStateNode(childStateNode)) {
        return childStateNode.key;
      }
    }

    const stateValue: StateValue = {};
    for (const childStateNode of childStateNodes) {
      stateValue[childStateNode.key] = getValueFromAdj(childStateNode);
    }

    return stateValue;
  };

  return getValueFromAdj(rootNode);
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

function getLegacyEventType(event: EventObject): string | undefined {
  switch (event.type) {
    case 'xstate.done.actor':
    case 'xstate.error.actor':
      return `${event.type}.${(event as any).actorId}`;
    case 'xstate.snapshot.actor':
      return `xstate.snapshot.${(event as any).actorId}`;
    case 'xstate.done.state':
      return `xstate.done.state.${(event as any).stateId}`;
    case 'xstate.after':
      return `xstate.after.${(event as any).delay}.${(event as any).stateId}`;
    case 'xstate.timeout':
      return `xstate.timeout.${(event as any).stateId}`;
    case 'xstate.timeout.actor':
      return `xstate.timeout.actor.${(event as any).actorId}`;
    default:
      return undefined;
  }
}

function getEventTypeAliases(event: EventObject): string[] {
  const legacyType = getLegacyEventType(event);
  return legacyType ? [event.type, legacyType] : [event.type];
}

export function getEventDescriptorKey(event: EventObject): string {
  const legacyType = getLegacyEventType(event);
  return legacyType ? `${event.type}|${legacyType}` : event.type;
}

export function matchesActorSession(
  event: EventObject,
  snapshot: AnyMachineSnapshot,
  actorId: string
): boolean {
  const child = snapshot.children[actorId] as
    | (AnyActor & { _incarnation?: string })
    | undefined;
  if (!child || !('sessionId' in event)) {
    return true;
  }
  if (isRemoteActorRef(child)) {
    // Without a host-supplied incarnation token the runtime that owns the
    // child is the authority on staleness; with one, a completion from a
    // different incarnation of the same address is dropped here.
    return (
      child._incarnation === undefined ||
      child._incarnation === (event as { sessionId?: string }).sessionId
    );
  }
  return child.sessionId === (event as { sessionId?: string }).sessionId;
}

function normalizeLegacyInternalEvent(
  event: EventObject,
  machine: AnyStateMachine
): EventObject {
  if (
    event.type === 'xstate.done.actor' ||
    event.type === 'xstate.error.actor' ||
    event.type === 'xstate.snapshot.actor' ||
    event.type === 'xstate.done.state' ||
    event.type === 'xstate.after' ||
    event.type === 'xstate.timeout' ||
    event.type === 'xstate.timeout.actor'
  ) {
    return event;
  }

  const normalizeWithId = (
    prefix: string,
    type: string,
    idKey: 'actorId' | 'stateId'
  ) =>
    event.type.startsWith(prefix)
      ? {
          ...event,
          type,
          [idKey]: (event as any)[idKey] ?? event.type.slice(prefix.length)
        }
      : undefined;

  const normalized =
    normalizeWithId('xstate.done.actor.', 'xstate.done.actor', 'actorId') ??
    normalizeWithId('xstate.error.actor.', 'xstate.error.actor', 'actorId') ??
    normalizeWithId('xstate.snapshot.', 'xstate.snapshot.actor', 'actorId') ??
    normalizeWithId('xstate.done.state.', 'xstate.done.state', 'stateId') ??
    normalizeWithId(
      'xstate.timeout.actor.',
      'xstate.timeout.actor',
      'actorId'
    ) ??
    normalizeWithId('xstate.timeout.', 'xstate.timeout', 'stateId');

  if (normalized) {
    return normalized;
  }

  const afterPrefix = 'xstate.after.';
  if (!event.type.startsWith(afterPrefix)) {
    return event;
  }

  const stateId = [...machine.idMap.keys()]
    .sort((a, b) => b.length - a.length)
    .find((id) => event.type.endsWith(`.${id}`));
  if (!stateId) {
    return event;
  }
  const delayText = event.type.slice(afterPrefix.length, -stateId.length - 1);
  return {
    ...event,
    type: 'xstate.after',
    delay: Number.isNaN(+delayText) ? delayText : +delayText,
    stateId
  } as AnyEventObject;
}

export function getCandidates<TEvent extends EventObject>(
  stateNode: StateNode<any, TEvent>,
  event: TEvent
): Array<TransitionDefinition<any, TEvent>> {
  const eventTypes = getEventTypeAliases(event);
  const exactMatches = eventTypes.flatMap(
    (eventType) => stateNode.transitions.get(eventType) ?? []
  );
  const wildcardCandidates = [...stateNode.transitions.keys()]
    .filter(
      (eventDescriptor) =>
        !eventTypes.includes(eventDescriptor) &&
        eventTypes.some((eventType) =>
          matchesEventDescriptor(eventType, eventDescriptor)
        )
    )
    .sort((a, b) => b.length - a.length)
    .flatMap((key) => stateNode.transitions.get(key)!);

  return exactMatches.length
    ? [...exactMatches, ...wildcardCandidates]
    : wildcardCandidates;
}

function scheduleDelayedEvent(
  stateNode: AnyStateNode,
  timerId: string,
  resolveEvent: (args: any) => AnyEventObject,
  resolveScheduledDelay: (x: {
    context: MachineContext;
    event: EventObject;
    delays: Record<string, any>;
    input?: Record<string, unknown>;
  }) => any
) {
  const oldEntry = stateNode.entry;
  stateNode.entry = (x: any, enq: any) => {
    enq.raise(resolveEvent(x) as any, {
      id: timerId,
      delay: resolveScheduledDelay(x)
    });
    return typeof oldEntry === 'function' ? oldEntry(x, enq) : undefined;
  };
  const oldExit = stateNode.exit;
  stateNode.exit = (_: any, enq: any) => {
    enq.cancel(timerId);
    return typeof oldExit === 'function' ? oldExit(_, enq) : undefined;
  };
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

  // Every delayed transition — `after`, state-level `timeout`/`onTimeout`, and
  // invoke-level `timeout`/`onTimeout` — has the same shape: an event raised on
  // entry (and cancelled on exit) plus a transition that catches it. They
  // differ only in the event raised, the transition(s) caught, and whether the
  // delay resolves against the machine's `delays` map (invoke timeouts do not).
  //
  // `xstate.timeout` is a dedicated event category so a state-level `timeout`
  // cannot collide with an explicit `after` entry on the same state. Invoke
  // timeouts are scheduled on the enclosing state; completion transitions
  // cancel the timer separately, so it clears even when the parent stays active.
  const sources: Array<{
    event: AnyEventObject;
    timerId: string;
    resolveEvent?: (args: any) => AnyEventObject;
    eventMatcher?: (
      event: EventObject,
      snapshot: AnyMachineSnapshot
    ) => boolean;
    delay: any;
    transitions: unknown;
    fromDelaysMap: boolean;
  }> = [];

  if (afterConfig) {
    for (const key of Object.keys(afterConfig)) {
      const delay = Number.isNaN(+key) ? key : +key;
      sources.push({
        event: createAfterEvent(delay, stateNode.id),
        timerId: createAfterEventId(delay, stateNode.id),
        delay,
        transitions: afterConfig[key],
        fromDelaysMap: true
      });
    }
  }

  if (timeoutConfig !== undefined && onTimeoutConfig) {
    sources.push({
      event: createTimeoutEvent(stateNode.id),
      timerId: createTimeoutEventId(stateNode.id),
      delay: timeoutConfig,
      transitions: onTimeoutConfig,
      fromDelaysMap: true
    });
  }

  for (const invokeDef of invokeDefs) {
    sources.push({
      event: createInvokeTimeoutEvent(invokeDef.id),
      timerId: createInvokeTimeoutEventId(invokeDef.id),
      resolveEvent: ({ children }: any) =>
        createInvokeTimeoutEvent(
          invokeDef.id,
          children[invokeDef.id]?.sessionId
        ),
      eventMatcher: (event, snapshot) =>
        matchesActorSession(event, snapshot, invokeDef.id),
      delay: invokeDef.timeout!,
      transitions: invokeDef.onTimeout,
      fromDelaysMap: false
    });
  }

  // `delay` here is the raw config value, retained only as metadata on the
  // transition definition — the live delay is resolved at runtime in the
  // scheduled entry action, so no eager resolution is needed.
  const delayedTransitions: Array<
    AnyTransitionConfig & {
      event: string;
      delay: any;
      _eventMatcher?: (
        event: EventObject,
        snapshot: AnyMachineSnapshot
      ) => boolean;
    }
  > = [];

  for (const {
    event,
    timerId,
    resolveEvent,
    eventMatcher,
    delay,
    transitions,
    fromDelaysMap
  } of sources) {
    scheduleDelayedEvent(
      stateNode,
      timerId,
      resolveEvent ?? (() => event),
      (x) =>
        resolveDelay(delay, fromDelaysMap ? x.delays : {}, {
          context: x.context,
          event: x.event,
          stateNode,
          input: x.input
        })
    );
    const { type: eventType, ...eventPattern } = event;
    for (const transition of toTransitionConfigArray(transitions as any)) {
      delayedTransitions.push({
        ...transition,
        matches: {
          ...transition.matches,
          ...Object.fromEntries(
            Object.entries(eventPattern).filter(
              ([, value]) => value !== undefined
            )
          )
        },
        event: eventType,
        delay,
        _eventMatcher: eventMatcher
      });
    }
  }

  return delayedTransitions.map((delayedTransition) => ({
    ...formatTransition(
      stateNode,
      delayedTransition.event,
      delayedTransition as AnyTransitionConfig
    ),
    delay: delayedTransition.delay
  }));
}

export function formatTransition(
  stateNode: AnyStateNode,
  descriptor: string,
  transitionConfig: AnyTransitionConfig
): AnyTransitionDefinition {
  const normalizedTarget = normalizeTarget(transitionConfig.target);
  const reenter = transitionConfig.reenter ?? false;
  const target = resolveTarget(stateNode, normalizedTarget);
  assertLegalTargetSet(stateNode, target);

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

function isStateNodeDescendantOf(
  stateNode: AnyStateNode,
  ancestor: AnyStateNode
): boolean {
  for (let current = stateNode.parent; current; current = current.parent) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

function getLeastCommonStateNodeAncestor(
  left: AnyStateNode,
  right: AnyStateNode
): AnyStateNode | undefined {
  const leftAncestors = new Set<AnyStateNode>();
  for (
    let current: AnyStateNode | undefined = left;
    current;
    current = current.parent
  ) {
    leftAncestors.add(current);
  }
  for (
    let current: AnyStateNode | undefined = right;
    current;
    current = current.parent
  ) {
    if (leftAncestors.has(current)) {
      return current;
    }
  }
  return undefined;
}

function assertLegalTargetSet(
  source: AnyStateNode,
  targets: readonly AnyStateNode[] | undefined
): void {
  if (!targets || targets.length < 2) {
    return;
  }
  for (let leftIndex = 0; leftIndex < targets.length; leftIndex++) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < targets.length;
      rightIndex++
    ) {
      const left = targets[leftIndex];
      const right = targets[rightIndex];
      const commonAncestor = getLeastCommonStateNodeAncestor(left, right);
      if (
        left === right ||
        isStateNodeDescendantOf(left, right) ||
        isStateNodeDescendantOf(right, left) ||
        commonAncestor?.type !== 'parallel'
      ) {
        throw new Error(
          isDevelopment
            ? `Invalid transition definition for state node '${source.id}': target set is not a legal SCXML configuration.`
            : `Invalid target set for '${source.id}'`
        );
      }
    }
  }
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
        const routeConfig = sn.config.route;
        const routeMatches = ({ event }: { event: any }) =>
          event.to === `#${routeId}`;

        if (typeof routeConfig === 'function') {
          // Transition-style route: the function is the guard and resolver.
          // Returning undefined/false blocks the route; returning true or a
          // config object allows it.
          routeTransitions.push(
            formatTransition(rootStateNode, 'xstate.route', {
              guard: routeMatches,
              to: (args: any) => {
                const result = routeConfig(args);
                if (!result) {
                  return undefined;
                }
                return {
                  ...(result === true ? {} : result),
                  target: `#${routeId}`
                };
              }
            } as AnyTransitionConfig)
          );
          if (sn.states) {
            collectRoutes(sn.states);
          }
          return;
        }

        const { guard: _guard, ...routeOptions } = routeConfig as any;
        const transition: AnyTransitionConfig = {
          ...routeOptions,
          guard: routeMatches,
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
          isDevelopment
            ? `Invalid transition definition for state node '${stateNode.id}':\n${err.message}`
            : `Invalid transition for '${stateNode.id}': ${err.message}`
        );
      }
    } else {
      throw new Error(
        isDevelopment
          ? `Invalid target: "${target}" is not a valid target from the root node. Did you mean ".${target}"?`
          : `Invalid target: "${target}"`
      );
    }
  });
}

function resolveHistoryDefaultTransition(
  stateNode: AnyStateNode & { type: 'history' }
): AnyTransitionDefinition {
  const normalizedTarget = normalizeTarget(stateNode.config.target);
  if (!normalizedTarget) {
    if (stateNode.parent!.type === 'parallel') {
      return {
        target: [stateNode.parent!],
        source: stateNode,
        reenter: false,
        eventType: '' as any
      };
    }
    return stateNode.parent!.initial as AnyTransitionDefinition;
  }
  const target = normalizedTarget.map((t) =>
    typeof t === 'string' ? getStateNodeByPath(stateNode.parent!, t) : t
  );
  assertLegalTargetSet(stateNode, target);
  return {
    target,
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
  const result = stateNode.states?.[stateKey];
  if (!result) {
    throw new Error(
      isDevelopment && !stateNode.states
        ? `Unable to retrieve child state '${stateKey}' from '${stateNode.id}'; no child states exist.`
        : `Child state '${stateKey}' does not exist on '${stateNode.id}'`
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

export type TransitionSelectionResult = {
  enabled: boolean;
  result: unknown;
  reusable: boolean;
};

export type TransitionSelectionResults = Map<
  AnyTransitionDefinition,
  TransitionSelectionResult
>;

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
  actorScope: AnyActorScope,
  selectionResults?: TransitionSelectionResults
): Array<TransitionDefinition<TContext, TEvent>> | undefined {
  // leaf node
  if (typeof stateValue === 'string') {
    const childStateNode = getStateNode(stateNode, stateValue);
    const next = childStateNode.next(
      snapshot,
      event,
      actorScope,
      selectionResults
    );

    if (!next || !next.length) {
      return stateNode.next(snapshot, event, actorScope, selectionResults);
    }

    return next;
  }

  const subStateKeys = Object.keys(stateValue);
  const subStateKey = subStateKeys[0];

  if (subStateKeys.length === 1) {
    const childStateNode = getStateNode(stateNode, subStateKey);
    const next = transitionNode(
      childStateNode,
      stateValue[subStateKey]!,
      snapshot,
      event,
      actorScope,
      selectionResults
    );

    if (!next || !next.length) {
      return stateNode.next(snapshot, event, actorScope, selectionResults);
    }

    return next;
  }

  const allInnerTransitions: Array<TransitionDefinition<TContext, TEvent>> = [];

  for (const subStateKey of subStateKeys) {
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
      actorScope,
      selectionResults
    );
    if (innerTransitions) {
      allInnerTransitions.push(...innerTransitions);
    }
  }

  if (!allInnerTransitions.length) {
    return stateNode.next(snapshot, event, actorScope, selectionResults);
  }

  return allInnerTransitions;
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
  resolveTransition: TransitionResultResolver
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
        resolveTransition
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
        } else if (t2.source.type === 'final' && t1.source.type !== 'final') {
          // A transition sourced in a final state yields to a conflicting
          // transition from a live state, so a done region doesn't keep
          // consuming events its siblings can still handle.
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

type ResolvableTransition = Parameters<typeof getTransitionResult>[0];
type TransitionResultResolver = (
  transition: ResolvableTransition
) => ReturnType<typeof getTransitionResult>;

function createTransitionResultResolver(
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  resolveActions: boolean,
  selectionResults?: TransitionSelectionResults
): TransitionResultResolver {
  let cache:
    | Map<ResolvableTransition, ReturnType<typeof getTransitionResult>>
    | undefined;
  return (transition) => {
    if (!transition.to) {
      return getTransitionResult(transition, snapshot, event, actorScope, {
        resolveActions,
        selectionResult: selectionResults?.get(
          transition as AnyTransitionDefinition
        )
      });
    }
    let result = cache?.get(transition);
    if (!result) {
      result = getTransitionResult(transition, snapshot, event, actorScope, {
        resolveActions,
        selectionResult: selectionResults?.get(
          transition as AnyTransitionDefinition
        )
      });
      (cache ??= new Map()).set(transition, result);
    }
    return result;
  };
}

function getEffectiveTargetStates(
  transition: Pick<AnyTransitionDefinition, 'target' | 'source'>,
  snapshot: AnyMachineSnapshot,
  resolveTransition: TransitionResultResolver
): Array<AnyStateNode> {
  const historyValue = snapshot.historyValue;
  const { targets } = resolveTransition(transition);
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
          resolveTransition
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

/**
 * Narrows a parallel domain to the single child region that contains every
 * effective target, so that a transition confined to one region does not exit
 * (and reset) its sibling regions.
 */
function narrowParallelDomain(
  domain: AnyStateNode,
  targetStates: Array<AnyStateNode>
): AnyStateNode {
  let narrowed = domain;
  while (narrowed.type === 'parallel') {
    const region = getChildren(narrowed).find((child) =>
      targetStates.every(
        (target) => target === child || isDescendant(target, child)
      )
    );
    if (!region) {
      break;
    }
    narrowed = region;
  }
  return narrowed;
}

function getTransitionDomain(
  transition: AnyTransitionDefinition,
  snapshot: AnyMachineSnapshot,
  resolveTransition: TransitionResultResolver
): AnyStateNode | undefined {
  const targetStates = getEffectiveTargetStates(
    transition,
    snapshot,
    resolveTransition
  );

  const { targets, reenter } = resolveTransition(transition);

  // A history target that restores the source itself must exit and reenter
  // the source (SCXML domain = the source's ancestor), unlike a plain
  // non-reentering self-target: the enter set restores the stored
  // configuration from outside the source, so the exit set must match or the
  // source's invoked actors are re-created without being stopped.
  const restoresSourceViaHistory =
    targets?.some(isHistoryNode) &&
    targetStates.some((target) => target === transition.source);

  if (
    !restoresSourceViaHistory &&
    targetStates.every(
      (target) =>
        target === transition.source || isDescendant(target, transition.source)
    )
  ) {
    // Targets are contained within the source. A reentering transition
    // exits and reenters the source itself; otherwise the domain narrows
    // past parallel nodes so sibling regions are left untouched.
    return reenter
      ? transition.source
      : narrowParallelDomain(transition.source, targetStates);
  }

  const [head, ...tail] = targetStates.concat(transition.source);
  // Find the least common ancestor (LCA) of the source and effective targets.
  for (const ancestor of getProperAncestors(head, undefined)) {
    if (tail.every((sn) => isDescendant(sn, ancestor))) {
      // A cross-region transition (source in one parallel region, targets in
      // another) only exits the region containing its targets; the source
      // region and other sibling regions stay put unless it reenters.
      return reenter ? ancestor : narrowParallelDomain(ancestor, targetStates);
    }
  }

  // at this point we know that it's a root transition since LCA couldn't be found
  if (reenter) {
    return;
  }

  return narrowParallelDomain(transition.source.machine.root, targetStates);
}

function computeExitSet(
  transitions: Array<AnyTransitionDefinition>,
  stateNodeSet: Set<AnyStateNode>,
  snapshot: AnyMachineSnapshot,
  resolveTransition: TransitionResultResolver
): Array<AnyStateNode> {
  const statesToExit = new Set<AnyStateNode>();
  for (const transition of transitions) {
    const { targets, reenter } = resolveTransition(transition);

    if (targets?.length) {
      const domain = getTransitionDomain(
        transition,
        snapshot,
        resolveTransition
      );

      if (reenter && transition.source === domain) {
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
  internalQueue: Array<AnyEventObject>,
  selectionResults?: TransitionSelectionResults
): Microstep {
  const executableActions: ExecutableActionObject[] = [];

  if (!transitions.length) {
    return [currentSnapshot, executableActions];
  }

  {
    const mutStateNodeSet = new Set(currentSnapshot.nodes as StateNode[]);
    let historyValue = currentSnapshot.historyValue;
    const originalContext = currentSnapshot.context;

    const filteredTransitions =
      transitions.length === 1
        ? transitions
        : removeConflictingTransitions(
            transitions,
            mutStateNodeSet,
            currentSnapshot,
            createTransitionResultResolver(
              currentSnapshot,
              event,
              actorScope,
              false,
              selectionResults
            )
          );
    const getCurrentTransitionResult = createTransitionResultResolver(
      currentSnapshot,
      event,
      actorScope,
      true,
      selectionResults
    );
    const changesState = filteredTransitions.some((transition) => {
      const { targets, reenter } = getCurrentTransitionResult(transition);
      return !!targets?.length || !!reenter;
    });
    const getStateActionsAndContext = (
      transitionFn: any,
      context: MachineContext,
      children: AnyMachineSnapshot['children'],
      input: Record<string, unknown> | undefined
    ): [
      actions: any[],
      context: MachineContext | undefined,
      internalEvents: EventObject[] | undefined
    ] => {
      if (transitionFn.length === 2) {
        // enqueue action; retrieve
        const actions: any[] = [];
        const internalEvents: EventObject[] = [];
        let updatedContext: MachineContext | undefined;

        const enqueue = createTransitionEnqueue(
          actorScope,
          actions,
          internalEvents,
          true
        );

        const args = isLazyActorScope(actorScope)
          ? withActorScope(
              {
                context,
                event,
                children,
                actions: currentSnapshot.machine.sources.actions,
                actors: currentSnapshot.machine.sources.actors,
                guards: currentSnapshot.machine.sources.guards,
                delays: currentSnapshot.machine.sources.delays,
                input
              },
              actorScope
            )
          : {
              context,
              event,
              parent: actorScope.self._parent,
              self: actorScope.self,
              children,
              system: actorScope.system,
              actions: currentSnapshot.machine.sources.actions,
              actors: currentSnapshot.machine.sources.actors,
              guards: currentSnapshot.machine.sources.guards,
              delays: currentSnapshot.machine.sources.delays,
              input
            };
        const res = transitionFn(args, enqueue);

        if (res?.context !== undefined) {
          updatedContext = mergeContextPatch(context, res.context);
        }

        return [actions, updatedContext, internalEvents];
      }

      // For 1-argument actions, wrap them to include input
      // Preserve _special flag if present (for entry/exit actions)
      const wrappedAction = Object.assign(
        (args: any, enqueue: any) =>
          transitionFn(
            isLazyActorScope(actorScope)
              ? withActorScope(
                  {
                    context: args.context,
                    event: args.event,
                    output: args.output,
                    children: args.children,
                    actions: args.actions,
                    actors: args.actors,
                    input
                  },
                  actorScope
                )
              : { ...args, input },
            enqueue
          ),
        '_special' in transitionFn ? { _special: true } : {}
      );
      return [[wrappedAction], undefined, undefined];
    };

    let nextState = currentSnapshot;
    const getInvokeStopActions = (
      stateNode: AnyStateNode,
      children: AnyMachineSnapshot['children']
    ): AnyAction[] => {
      const actions: AnyAction[] = [];
      const enqueue = createTransitionEnqueue(actorScope, actions, []);
      for (const invokeDef of stateNode.invoke) {
        const child = children[invokeDef.id];
        if (child) {
          enqueue.stop(child);
        }
      }
      return actions;
    };
    const exitStates = () => {
      const statesToExit = computeExitSet(
        filteredTransitions,
        mutStateNodeSet,
        currentSnapshot,
        getCurrentTransitionResult
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
        const stateInput = getStateInput(currentSnapshot, exitStateNode.id);

        const [exitActions, nextContext, internalEvents] = exitStateNode.exit
          ? getStateActionsAndContext(
              exitStateNode.exit,
              nextState.context,
              currentSnapshot.children,
              stateInput
            )
          : [[], undefined, undefined];
        if (internalEvents?.length) {
          internalQueue.push(...internalEvents);
        }
        if (nextContext) {
          nextState = cloneMachineSnapshot(nextState, {
            context: nextContext
          });
        }
        const [resolvedState, resolvedActions] = resolveActionsWithContext(
          nextState,
          event,
          actorScope,
          exitActions
        );
        nextState = resolvedState;
        executableActions.push(...resolvedActions);

        const invokeStopActions = getInvokeStopActions(
          exitStateNode,
          nextState.children
        );
        if (invokeStopActions.length) {
          const [stoppedState, stopEffects] = resolveActionsWithContext(
            nextState,
            event,
            actorScope,
            invokeStopActions
          );
          nextState = stoppedState;
          executableActions.push(...stopEffects);
        }

        mutStateNodeSet.delete(exitStateNode);
      }

      historyValue = changedHistory || historyValue;
    };

    // Exit states
    if (!isInitial && changesState) {
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
      if (res.context !== undefined) {
        context = mergeContextPatch(context, res.context);
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

        let completionOutput: unknown;
        if (
          rootCompletionNode.output !== undefined &&
          rootCompletionNode.parent
        ) {
          const rootDoneEvent = internalQueue.find(
            (e) =>
              e.type === 'xstate.done.state' &&
              (e as DoneStateEvent).stateId === rootNode.id
          ) as DoneStateEvent | undefined;
          completionOutput =
            rootDoneEvent && rootCompletionNode.parent === rootNode
              ? rootDoneEvent.output
              : resolveOutput(
                  rootCompletionNode.output,
                  nextState.context,
                  event,
                  actorScope.self,
                  stateInputMap[rootCompletionNode.id]
                );
        } else if (rootCompletionNode.type === 'parallel') {
          const parallelDoneEvent = internalQueue.find(
            (e) =>
              e.type === 'xstate.done.state' &&
              (e as DoneStateEvent).stateId === rootCompletionNode.id
          ) as DoneStateEvent | undefined;
          completionOutput = parallelDoneEvent?.output;
        }

        if (rootNode.output === undefined) {
          return rootCompletionNode.parent === rootNode
            ? completionOutput
            : undefined;
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

      const addDescendantStatesToEnter = (stateNode: AnyStateNode) => {
        if (isHistoryNode(stateNode)) {
          if (historyValue[stateNode.id]) {
            const historyStateNodes = historyValue[stateNode.id];
            for (const s of historyStateNodes) {
              statesToEnter.add(s);
              addDescendantStatesToEnter(s);
            }
            for (const s of historyStateNodes) {
              addAncestorStatesToEnter(
                getProperAncestors(s, stateNode.parent),
                undefined
              );
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
              addAncestorStatesToEnter(
                getProperAncestors(s, stateNode.parent),
                undefined
              );
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
          addAncestorStatesToEnter(
            getProperAncestors(initialState, stateNode),
            undefined
          );
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
          getCurrentTransitionResult
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
          getCurrentTransitionResult
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
        if (reenter && domain === transition.source) {
          // A reentering transition whose domain is its own source exits and
          // reenters the source, so the source must be entered explicitly —
          // it has no ancestor inside the domain to add it.
          statesToEnter.add(transition.source);
        }
      }

      if (isInitial) {
        statesForDefaultEntry.add(currentSnapshot.machine.root);
      }

      const stateInputMap: Record<string, Record<string, unknown>> = {
        ...currentSnapshot._stateInputs
      };
      let stateInputsChanged = false;
      for (const transition of filteredTransitions) {
        const { targets, input } = getCurrentTransitionResult(transition);
        if (input && targets) {
          for (const targetNode of targets) {
            stateInputMap[targetNode.id] = input;
            stateInputsChanged = true;
          }
        }
      }

      const completedNodes = new Set<AnyStateNode>();
      const children = { ...nextState.children };
      for (const stateNodeToEnter of [...statesToEnter].sort(
        (a, b) => a.order - b.order
      )) {
        mutStateNodeSet.add(stateNodeToEnter);
        const actions: AnyAction[] = [];

        let invoked = false;
        for (const invokeDef of stateNodeToEnter.invoke) {
          invoked = true;

          let src = invokeDef.logic;
          if (typeof src === 'function') {
            src = src({
              actors: currentSnapshot.machine.sources.actors,
              context: nextState.context,
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
              isDevelopment
                ? `Actor logic '${typeof src === 'string' ? src : 'inline'}' not implemented in machine '${currentSnapshot.machine.id}'`
                : `Actor logic '${typeof src === 'string' ? src : 'inline'}' not implemented`
            );
          }

          const input =
            typeof invokeDef.input === 'function'
              ? invokeDef.input({
                  self: actorScope.self,
                  context: nextState.context,
                  event,
                  output: getEventOutput(event)
                })
              : invokeDef.input;

          assertChildIdFree(actorScope, invokeDef.id);
          const actor = actorScope.system.createActorRef(logic, {
            ...invokeDef,
            input,
            parent: actorScope.self,
            syncSnapshot: !!invokeDef.onSnapshot
          });

          actions.push({
            action: builtInActions['@xstate.spawn'],
            args: [actor]
          });

          if (invokeDef.id) {
            children[invokeDef.id] = actor;
          }
        }

        if (invoked) {
          nextState = cloneMachineSnapshot(nextState, { children });
        }
        let context = nextState.context;
        let contextChangedByEntry = false;

        const stateInput = stateInputMap[stateNodeToEnter.id];

        if (stateNodeToEnter.entry) {
          const [resultActions, nextContext, nextInternalEvents] =
            getStateActionsAndContext(
              stateNodeToEnter.entry,
              context,
              children,
              stateInput
            );
          actions.push(...resultActions);
          if (nextInternalEvents?.length) {
            internalQueue.push(...nextInternalEvents);
          }
          if (nextContext) {
            context = nextContext;
            contextChangedByEntry = true;
          }
        }

        if (contextChangedByEntry) {
          nextState.context = context;
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
              stateInputsChanged = true;
            }
          }
        }

        const [resolvedState, resolvedActions] = resolveActionsWithContext(
          nextState,
          event,
          actorScope,
          actions
        );
        nextState = resolvedState;
        actions.length = 0;
        executableActions.push(...resolvedActions);

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
                    actorScope.self,
                    stateInput
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
                      actorScope.self,
                      stateInputMap[region.id]
                    )
                  : undefined;
              continue;
            }

            if (region.type === 'parallel') {
              const regionDoneEvent = internalQueue.find(
                (e) =>
                  e.type === 'xstate.done.state' &&
                  (e as DoneStateEvent).stateId === region.id
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
                    actorScope.self,
                    stateInputMap[finalChild.id]
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

      if (stateInputsChanged) {
        nextState = cloneMachineSnapshot(nextState, {
          _stateInputs: stateInputMap
        });
      }
    };

    // Execute transition content
    const [resolvedTransitionState, transitionExecutableActions] =
      resolveActionsWithContext(
        nextState,
        event,
        actorScope,
        transitionActions
      );
    nextState = resolvedTransitionState;
    executableActions.push(...transitionExecutableActions);
    if (context && context !== currentSnapshot.context) {
      nextState = cloneMachineSnapshot(nextState, { context });
    }

    // Enter states
    if (isInitial || changesState) {
      enterStates();
    }

    const nextStateNodes = [...mutStateNodeSet];

    if (nextState.status === 'done') {
      const allExitActions: AnyAction[] = [];
      const nextStateNodesToExit = nextStateNodes.sort(
        (a, b) => b.order - a.order
      );

      nextStateNodesToExit.forEach((stateNode) => {
        if (stateNode.exit) {
          const stateInput = getStateInput(nextState, stateNode.id);
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

      const [resolvedState, resolvedActions] = resolveActionsWithContext(
        nextState,
        event,
        actorScope,
        allExitActions
      );
      nextState = resolvedState;
      executableActions.push(...resolvedActions);

      const [stoppedState, stopEffects] = stopChildren(
        nextState,
        event,
        actorScope
      );
      nextState = stoppedState;
      executableActions.push(...stopEffects);

      const [withoutTimers, cancelEffects] = cancelTimers(
        nextState,
        event,
        actorScope
      );
      nextState = withoutTimers;
      executableActions.push(...cancelEffects);
    }

    if (
      historyValue === currentSnapshot.historyValue &&
      currentSnapshot.nodes.length === mutStateNodeSet.size &&
      currentSnapshot.nodes.every((node) =>
        mutStateNodeSet.has(node as StateNode)
      )
    ) {
      // If context was changed (e.g. by entry actions during self-transition),
      // clone to ensure reference inequality for eventless transition re-evaluation
      if (nextState.context !== originalContext) {
        return [
          nextState === currentSnapshot
            ? cloneMachineSnapshot(nextState)
            : nextState,
          executableActions
        ];
      }
      return [nextState, executableActions];
    }

    return [
      cloneMachineSnapshot(nextState, {
        _nodes: nextStateNodes,
        historyValue
      }),
      executableActions
    ];
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
    context?: AnyTransitionDefinition['context'];
  },
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  options?: {
    resolveActions?: boolean;
    selectionResult?: TransitionSelectionResult;
  }
): {
  targets: Readonly<AnyStateNode[]> | undefined;
  context: MachineContext | undefined;
  actions: AnyAction[] | undefined;
  reenter?: boolean;
  internalEvents: EventObject[] | undefined;
  input: Record<string, unknown> | undefined;
} {
  let transitionArgs: any;
  const getTransitionArgs = () =>
    (transitionArgs ??= isLazyActorScope(actorScope)
      ? withActorScope(
          {
            context: snapshot.context,
            event,
            output: getEventOutput(event),
            value: snapshot.value,
            children: snapshot.children,
            actions: snapshot.machine.sources.actions,
            actors: snapshot.machine.sources.actors,
            guards: snapshot.machine.sources.guards,
            delays: snapshot.machine.sources.delays,
            input: getStateInput(snapshot, transition.source.id)
          },
          actorScope
        )
      : {
          context: snapshot.context,
          event,
          output: getEventOutput(event),
          value: snapshot.value,
          children: snapshot.children,
          system: actorScope.system,
          parent: actorScope.self._parent,
          self: actorScope.self,
          actions: snapshot.machine.sources.actions,
          actors: snapshot.machine.sources.actors,
          guards: snapshot.machine.sources.guards,
          delays: snapshot.machine.sources.delays,
          input: getStateInput(snapshot, transition.source.id)
        });

  if (transition.to) {
    const actions: AnyAction[] = [];
    const internalEvents: EventObject[] = [];
    const res = options?.selectionResult?.reusable
      ? options.selectionResult.result
      : transition.to(
          getTransitionArgs(),
          createTransitionEnqueue(
            actorScope,
            actions,
            internalEvents,
            true,
            options?.resolveActions ?? true
          )
        );

    const targets = res?.target
      ? resolveTarget(transition.source, toArray(res.target) as string[])
      : undefined;

    const resolvedInput =
      res?.input ??
      (typeof transition.input === 'function'
        ? transition.input({
            context: snapshot.context,
            event,
            output: getEventOutput(event)
          })
        : transition.input);

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
      ? transition.input({
          context: snapshot.context,
          event,
          output: getEventOutput(event)
        })
      : transition.input;
  const resolvedContext =
    typeof transition.context === 'function'
      ? transition.context(getTransitionArgs())
      : transition.context;

  return {
    targets: transition.target as AnyStateNode[] | undefined,
    context: resolvedContext,
    reenter: transition.reenter,
    actions: undefined,
    internalEvents: undefined,
    input: resolvedInput
  };
}

export function macrostep(
  snapshot: AnyMachineSnapshot,
  event: EventObject,
  actorScope: AnyActorScope,
  internalQueue: AnyEventObject[],
  initialMicrosteps: Microstep[] = []
): {
  snapshot: typeof snapshot;
  microsteps: Microstep[];
} {
  let nextSnapshot = snapshot;
  const microsteps: Microstep[] = initialMicrosteps.slice();

  function removeTerminatedChild(terminalEvent: EventObject) {
    if (
      terminalEvent.type !== 'xstate.done.actor' &&
      terminalEvent.type !== 'xstate.error.actor'
    ) {
      return;
    }

    const { actorId, sessionId } = terminalEvent as AnyEventObject & {
      actorId?: string;
      sessionId?: string;
    };
    if (!actorId) {
      return;
    }
    const child = nextSnapshot.children[actorId] as
      | (AnyActor & { _incarnation?: string })
      | undefined;
    if (!child) {
      return;
    }
    // The same staleness rule matchesActorSession applies to transition
    // selection: a completion from a different incarnation must not remove
    // the still-running child either.
    if (isRemoteActorRef(child)) {
      if (
        child._incarnation !== undefined &&
        child._incarnation !== sessionId
      ) {
        return;
      }
    } else if (child.sessionId !== sessionId) {
      return;
    }

    const children = { ...nextSnapshot.children };
    delete children[actorId];
    actorScope.system._unregister(child);
    nextSnapshot = cloneMachineSnapshot(nextSnapshot, { children });

    if (microsteps.length) {
      const [, lastEffects] = microsteps.at(-1)!;
      microsteps[microsteps.length - 1] = [nextSnapshot, lastEffects];
    } else {
      microsteps.push([nextSnapshot, []]);
    }
  }

  function completeMacrostep() {
    const effects = microsteps.flatMap(([, actions]) => actions);
    const starts = deriveDeferredStarts(effects);
    const shouldTerminate =
      (snapshot.status === 'active' || initialMicrosteps.length > 0) &&
      (nextSnapshot.status === 'done' || nextSnapshot.status === 'error');

    if (starts.length || shouldTerminate) {
      const terminalEffects = shouldTerminate
        ? [...starts, createTerminationEffect(actorScope, nextSnapshot)]
        : starts;
      if (microsteps.length) {
        const [lastSnapshot, lastEffects] = microsteps.at(-1)!;
        microsteps[microsteps.length - 1] = [
          lastSnapshot,
          [...lastEffects, ...terminalEffects]
        ];
      } else {
        microsteps.push([nextSnapshot, terminalEffects]);
      }
    }

    return { snapshot: nextSnapshot, microsteps };
  }

  function addMicrostep(
    step: Microstep,
    transitions: AnyTransitionDefinition[]
  ) {
    // collect microsteps; surfaced on the enclosing '@xstate.transition' event
    // via its `microsteps[]` facet (there is no standalone microstep event)
    if (
      !isInertActorScope(actorScope) &&
      (event.type === XSTATE_INIT ||
        (actorScope.system._hasInspectionObservers?.() ?? true))
    ) {
      const collectedMicrosteps =
        ((actorScope.self as any)._collectedMicrosteps as any[]) || [];
      collectedMicrosteps.push(...transitions);
      (actorScope.self as any)._collectedMicrosteps = collectedMicrosteps;
    }
    microsteps.push(step);
  }

  // Handle stop event
  if (event.type === XSTATE_STOP) {
    const [stoppedChildrenSnapshot, stopEffects] = stopChildren(
      nextSnapshot,
      event,
      actorScope
    );
    const [withoutTimers, cancelEffects] = cancelTimers(
      stoppedChildrenSnapshot,
      event,
      actorScope
    );
    nextSnapshot = cloneMachineSnapshot(withoutTimers, {
      status: 'stopped'
    });
    addMicrostep([nextSnapshot, [...stopEffects, ...cancelEffects]], []);
    return completeMacrostep();
  }

  let nextEvent = normalizeLegacyInternalEvent(event, snapshot.machine);

  if (event.type === XSTATE_TIMER) {
    const timer = nextSnapshot.timers[(event as any).id];
    if (!timer) {
      return completeMacrostep();
    }

    const timers = { ...nextSnapshot.timers };
    delete timers[timer.id];
    nextSnapshot = cloneMachineSnapshot(nextSnapshot, { timers });
    if (timer.type === '@xstate.raise') {
      internalQueue.push(timer.event);
      addMicrostep([nextSnapshot, []], []);
    } else {
      const target = timer.target === 'self' ? actorScope.self : timer.target;
      addMicrostep(
        [nextSnapshot, [createSendToEffect(actorScope, target, timer.event)]],
        []
      );
    }
  }

  // Assume the state is at rest (no raised events)
  // Determine the next state based on the next microstep
  if (nextEvent.type !== XSTATE_INIT && nextEvent.type !== XSTATE_TIMER) {
    const currentEvent = nextEvent;
    const isErr = isErrorEvent(currentEvent);
    const selectionResults: TransitionSelectionResults = new Map();

    const transitions = nextSnapshot.machine.getTransitionData(
      nextSnapshot as any,
      currentEvent,
      actorScope,
      selectionResults
    );

    if (isErr && !transitions.length) {
      if (
        currentEvent.type === 'xstate.error.actor' &&
        !matchesActorSession(
          currentEvent,
          nextSnapshot,
          (currentEvent as AnyEventObject).actorId
        )
      ) {
        return completeMacrostep();
      }
      // TODO: we should likely only allow transitions selected by very explicit descriptors
      // `*` shouldn't be matched, likely `xstate.error.*` shouldn't be either
      // similarly `xstate.error.actor.*` and `xstate.error.actor.todo.*` have to be considered too
      nextSnapshot = cloneMachineSnapshot<typeof snapshot>(snapshot, {
        status: 'error',
        error: currentEvent.error
      });
      addMicrostep([nextSnapshot, []], []);
      removeTerminatedChild(currentEvent);
      return completeMacrostep();
    }
    const step = microstep(
      transitions,
      snapshot,
      actorScope,
      nextEvent,
      false, // isInitial
      internalQueue,
      selectionResults
    );
    nextSnapshot = step[0];
    addMicrostep(step, transitions);
    removeTerminatedChild(currentEvent);
  }

  if (
    !internalQueue.length &&
    snapshot.machine._hasEventlessTransitions === false
  ) {
    return completeMacrostep();
  }

  let shouldSelectEventlessTransitions = true;
  const maxIterations = snapshot.machine.options?.maxIterations ?? Infinity;
  let iterationCount = 0;

  let microstepCount = 0;
  while (nextSnapshot.status === 'active') {
    microstepCount++;
    if (microstepCount > 1000) {
      throw new Error('Microstep count exceeded 1000');
    }
    iterationCount++;
    if (iterationCount > maxIterations) {
      throw new Error(
        isDevelopment
          ? `Infinite loop detected: the machine has processed more than ${maxIterations} microsteps without reaching a stable state. This usually happens when there's a cycle of transitions (e.g., eventless transitions or raised events causing state A -> B -> C -> A).`
          : `Infinite loop detected (>${maxIterations} microsteps)`
      );
    }

    let selectionResults: TransitionSelectionResults | undefined;
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
      selectionResults = new Map();
      enabledTransitions = nextSnapshot.machine.getTransitionData(
        nextSnapshot as any,
        nextEvent,
        actorScope,
        selectionResults
      );
    }

    const step = microstep(
      enabledTransitions,
      nextSnapshot,
      actorScope,
      nextEvent,
      false,
      internalQueue,
      selectionResults
    );
    nextSnapshot = step[0];
    shouldSelectEventlessTransitions = nextSnapshot !== previousState;
    addMicrostep(step, enabledTransitions);
    removeTerminatedChild(nextEvent);
  }

  return completeMacrostep();
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

export function hasEffect(
  transition: AnyTransitionDefinition,
  context: MachineContext,
  event: EventObject,
  snapshot: AnyMachineSnapshot,
  actorScope: AnyActorScope
): boolean {
  if (transition.to) {
    return evaluateTransitionFunction(
      transition.to,
      context,
      event,
      snapshot,
      actorScope,
      snapshot.machine.sources,
      transition.source.id
    ).enabled;
  }

  return false;
}

const triggerTransitionEffect = () => {
  throw transitionEffectSignal;
};
let transitionEffectEnqueue: ReturnType<typeof createEnqueueObject> | undefined;
function getTransitionEffectEnqueue() {
  return (transitionEffectEnqueue ??= createEnqueueObject(
    {
      emit: triggerTransitionEffect,
      cancel: triggerTransitionEffect,
      log: triggerTransitionEffect,
      raise: triggerTransitionEffect,
      spawn: triggerTransitionEffect,
      sendTo: triggerTransitionEffect,
      stop: triggerTransitionEffect,
      listen: triggerTransitionEffect,
      subscribeTo: triggerTransitionEffect
    },
    triggerTransitionEffect
  ));
}

function evaluateTransitionFunction(
  transitionTo: NonNullable<AnyTransitionDefinition['to']>,
  context: MachineContext,
  event: EventObject,
  snapshot: AnyMachineSnapshot,
  actorScope: AnyActorScope,
  sources: AnyMachineSnapshot['machine']['sources'],
  sourceId: string
): TransitionSelectionResult {
  let res;
  const parent = getActorScopeParent(actorScope);
  if (parent) {
    transitionEffectTargets.push(parent);
  }

  try {
    res = transitionTo(
      withActorScope(
        {
          context,
          event,
          output: getEventOutput(event),
          value: snapshot.value,
          children: snapshot.children,
          actions: sources.actions,
          actors: sources.actors,
          guards: sources.guards,
          delays: sources.delays,
          input: getStateInput(snapshot, sourceId)
        },
        actorScope
      ),
      getTransitionEffectEnqueue()
    );
  } catch (err) {
    if (err === transitionEffectSignal) {
      return { enabled: true, result: undefined, reusable: false };
    }
    throw err;
  } finally {
    if (parent) {
      transitionEffectTargets.pop();
    }
  }

  return { enabled: res !== undefined, result: res, reusable: true };
}

function stopChildren(
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
): [AnyMachineSnapshot, ExecutableActionObject[]] {
  let children: AnyActor[];
  if (
    !snapshot.children ||
    (children = Object.values(snapshot.children).filter(Boolean) as AnyActor[])
      .length === 0
  ) {
    return [snapshot, []];
  }
  const actions: AnyAction[] = [];
  const enqueue = createTransitionEnqueue(actorScope, actions, []);
  for (const child of children) {
    enqueue.stop(child);
  }
  return resolveActionsWithContext(snapshot, event, actorScope, actions);
}

function cancelTimers(
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
): [AnyMachineSnapshot, ExecutableActionObject[]] {
  const timerIds = Object.keys(snapshot.timers);
  if (!timerIds.length) {
    return [snapshot, []];
  }
  const actions: AnyAction[] = [];
  const enqueue = createTransitionEnqueue(actorScope, actions, []);
  for (const id of timerIds) {
    enqueue.cancel(id);
  }
  return resolveActionsWithContext(snapshot, event, actorScope, actions);
}

function selectEventlessTransitions(
  snapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope
) {
  const enabledTransitionSet: Set<AnyTransitionDefinition> = new Set();
  const atomicStates = snapshot.nodes.filter(isAtomicStateNode);

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
          evaluateCandidate(transition, event, snapshot, stateNode, actorScope)
        ) {
          enabledTransitionSet.add(transition);
          break loop;
        }
      }
    }
  }

  return removeConflictingTransitions(
    Array.from(enabledTransitionSet),
    new Set(snapshot.nodes),
    snapshot,
    createTransitionResultResolver(snapshot, event, actorScope, false)
  );
}

export function evaluateCandidate(
  candidate: AnyTransitionDefinition,
  event: EventObject,
  snapshot: AnyMachineSnapshot,
  stateNode: AnyStateNode,
  actorScope: AnyActorScope,
  selectionResults?: TransitionSelectionResults
): boolean {
  if (candidate.matches && !matchesEvent(event, candidate.matches)) {
    return false;
  }

  if (candidate._eventMatcher && !candidate._eventMatcher(event, snapshot)) {
    return false;
  }

  if (candidate.guard) {
    const guardArgs = withActorSelfAndParent(
      {
        context: snapshot.context,
        event,
        output: getEventOutput(event),
        children: snapshot.children,
        actions: stateNode.machine.sources.actions,
        actors: stateNode.machine.sources.actors,
        guards: stateNode.machine.sources.guards,
        delays: stateNode.machine.sources.delays,
        _snapshot: snapshot
      },
      actorScope
    );
    if (!(candidate.guard as (args: typeof guardArgs) => boolean)(guardArgs)) {
      return false;
    }
  }

  if (candidate.to) {
    const evaluation = evaluateTransitionFunction(
      candidate.to,
      snapshot.context,
      event,
      snapshot,
      actorScope,
      stateNode.machine.sources,
      candidate.source.id
    );
    selectionResults?.set(candidate, evaluation);
    return evaluation.enabled;
  }

  return true;
}
