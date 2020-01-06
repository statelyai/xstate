import {
  toStatePath,
  toStatePaths,
  flatten,
  mapFilterValues,
  nestedPath,
  toArray,
  keys,
  warn,
  isArray,
  isFunction,
  isString,
  toGuard,
  isMachine,
  toTransitionConfigArray,
  normalizeTarget,
  toStateValue
} from './utils';
import {
  StateValue,
  TransitionConfig,
  EventObject,
  HistoryValue,
  TransitionDefinition,
  DelayedTransitionDefinition,
  NullEvent,
  SingleOrArray,
  Typestate,
  DelayExpr
} from './types';
import { State } from './State';
import {
  send,
  cancel,
  after,
  done,
  doneInvoke,
  error,
  toActionObjects
} from './actions';
import { IS_PRODUCTION } from './environment';
import { isLeafNode } from './stateUtils';
import {
  StateNode,
  NULL_EVENT,
  WILDCARD,
  isStateId,
  STATE_IDENTIFIER
} from './StateNode';

const validateArrayifiedTransitions = <TContext>(
  stateNode: StateNode<any, any, any>,
  event: string,
  transitions: Array<
    TransitionConfig<TContext, EventObject> & {
      event: string;
    }
  >
) => {
  const hasNonLastUnguardedTarget = transitions
    .slice(0, -1)
    .some(
      transition =>
        !('cond' in transition) &&
        !('in' in transition) &&
        (isString(transition.target) || isMachine(transition.target))
    );
  const eventText =
    event === NULL_EVENT ? 'the transient event' : `event '${event}'`;
  warn(
    !hasNonLastUnguardedTarget,
    `One or more transitions for ${eventText} on state '${stateNode.id}' are unreachable. ` +
      `Make sure that the default transition is the last one defined.`
  );
};
export function getCandidates<TEvent extends EventObject>(
  stateNode: StateNode<any, any, TEvent>,
  eventName: TEvent['type'] | NullEvent['type'] | '*'
) {
  if (stateNode.__cache.candidates[eventName]) {
    return stateNode.__cache.candidates[eventName];
  }
  const transient = eventName === NULL_EVENT;
  const candidates = stateNode.transitions.filter(transition => {
    const sameEventType = transition.eventType === eventName;
    // null events should only match against eventless transitions
    return transient
      ? sameEventType
      : sameEventType || transition.eventType === WILDCARD;
  }) as any;
  stateNode.__cache.candidates[eventName] = candidates;
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
          _target => isString(_target) && _target[0] === stateNode.delimiter
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
          if (!IS_PRODUCTION) {
            validateArrayifiedTransitions(stateNode, key, arrayified);
          }
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
    const isInternalTarget = target[0] === stateNode.delimiter;
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
 *
 * @param historyValue
 */
function resolveHistory<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  historyValue?: HistoryValue
): Array<StateNode<TContext, any, TEvent>> {
  if (stateNode.type !== 'history') {
    return [stateNode];
  }
  const parent = stateNode.parent!;
  if (!historyValue) {
    const historyTarget = stateNode.target;
    return historyTarget
      ? flatten(
          toStatePaths(historyTarget).map(relativeChildPath =>
            getFromRelativePath(parent, relativeChildPath)
          )
        )
      : getInitialStateNodes(parent);
  }
  const subHistoryValue = nestedPath<HistoryValue>(parent.path, 'states')(
    historyValue
  ).current;
  if (isString(subHistoryValue)) {
    return [getStateNode(parent, subHistoryValue)];
  }
  return flatten(
    toStatePaths(subHistoryValue!).map(subStatePath => {
      return stateNode.history === 'deep'
        ? getFromRelativePath(parent, subStatePath)
        : [parent.states[subStatePath[0]]];
    })
  );
}
export function getHistoryValue<TContext, TEvent extends EventObject>(
  stateNode: StateNode<TContext, any, TEvent>,
  relativeStateValue?: StateValue | undefined
): HistoryValue | undefined {
  if (!keys(stateNode.states).length) {
    return undefined;
  }
  return {
    current: relativeStateValue || stateNode.initialStateValue,
    states: mapFilterValues<
      StateNode<TContext, any, TEvent>,
      HistoryValue | undefined
    >(
      stateNode.states,
      (childNode, key) => {
        if (!relativeStateValue) {
          return getHistoryValue(childNode);
        }
        const subStateValue = isString(relativeStateValue)
          ? undefined
          : relativeStateValue[key];
        return getHistoryValue(
          childNode,
          subStateValue || childNode.initialStateValue
        );
      },
      childNode => !childNode.history
    )
  };
}
/**
 * Retrieves state nodes from a relative path to this state node.
 *
 * @param relativePath The relative path from this state node
 * @param historyValue
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
  if (childStateNode.type === 'history') {
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
 * Returns the leaf nodes from a state path relative to this state node.
 *
 * @param relativeStateId The relative state path to retrieve the state nodes
 * @param history The previous state to retrieve history
 * @param resolve Whether state nodes should resolve to initial child state nodes
 */
export function getRelativeStateNodes<TContext, TEvent extends EventObject>(
  relativeStateId: StateNode<TContext, any, TEvent>,
  historyValue?: HistoryValue,
  resolve: boolean = true
): Array<StateNode<TContext, any, TEvent>> {
  return resolve
    ? relativeStateId.type === 'history'
      ? resolveHistory(relativeStateId, historyValue)
      : getInitialStateNodes(relativeStateId)
    : [relativeStateId];
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
  stateNode: StateNode<TContext, TStateSchema, TEvent>,
  stateValue: StateValue,
  context?: TContext
): State<TContext, TEvent, TStateSchema, TTypestate> {
  const configuration = getStateNodes(stateNode, stateValue);
  return stateNode.resolveTransition(
    {
      configuration,
      entrySet: configuration,
      exitSet: [],
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
  const arrayStatePath = toStatePath(statePath, stateNode.delimiter).slice();
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
