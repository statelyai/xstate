import isDevelopment from '#is-development';
import { isMachineSnapshot } from './State.ts';
import type { StateNode } from './StateNode.ts';
import { TARGETLESS_KEY, WILDCARD } from './constants.ts';
import { isStateId } from './stateUtils.ts';
import type {
  AnyActor,
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  AnyTransitionConfig,
  AnyTransitionConfigFunction,
  EventObject,
  InvokeConfig,
  MachineContext,
  Mapper,
  NonReducibleUnknown,
  Observer,
  OutputArg,
  SingleOrArray,
  StateLike,
  StateValue,
  TransitionConfigTarget
} from './types.ts';

export function matchesState(
  parentStateId: StateValue,
  childStateId: StateValue
): boolean {
  const parentStateValue = toStateValue(parentStateId);
  const childStateValue = toStateValue(childStateId);

  if (typeof childStateValue === 'string') {
    if (typeof parentStateValue === 'string') {
      return childStateValue === parentStateValue;
    }

    // Parent more specific than child
    return false;
  }

  if (typeof parentStateValue === 'string') {
    return parentStateValue in childStateValue;
  }

  return Object.keys(parentStateValue).every((key) => {
    if (!(key in childStateValue)) {
      return false;
    }

    return matchesState(parentStateValue[key]!, childStateValue[key]!);
  });
}

export function checkStateIn(
  snapshot: AnyMachineSnapshot,
  stateValue: StateValue
) {
  if (typeof stateValue === 'string' && isStateId(stateValue)) {
    const target = snapshot.machine.getStateNodeById(stateValue);
    return snapshot.nodes.some((sn) => sn === target);
  }

  return snapshot.matches(stateValue);
}

export function toStatePath(stateId: string | string[]): string[] {
  if (Array.isArray(stateId)) {
    return stateId;
  }

  const result: string[] = [];
  let segment = '';

  for (let i = 0; i < stateId.length; i++) {
    const char = stateId.charCodeAt(i);
    switch (char) {
      // \
      case 92:
        // consume the next character
        segment += stateId[i + 1];
        // and skip over it
        i++;
        continue;
      // .
      case 46:
        result.push(segment);
        segment = '';
        continue;
    }
    segment += stateId[i];
  }

  result.push(segment);

  return result;
}

function toStateValue(stateValue: StateLike<any> | StateValue): StateValue {
  if (isMachineSnapshot(stateValue)) {
    return stateValue.value;
  }

  if (typeof stateValue !== 'string') {
    return stateValue as StateValue;
  }

  const statePath = toStatePath(stateValue);

  return pathToStateValue(statePath);
}

export function pathToStateValue(statePath: string[]): StateValue {
  if (statePath.length === 1) {
    return statePath[0];
  }

  const value: StateValue = {};
  let marker = value;

  for (let i = 0; i < statePath.length - 1; i++) {
    if (i === statePath.length - 2) {
      marker[statePath[i]] = statePath[i + 1];
    } else {
      const previous = marker;
      marker = {};
      previous[statePath[i]] = marker;
    }
  }

  return value;
}

function toArrayStrict<T>(value: readonly T[] | T): readonly T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [value as T];
}

export function toArray<T>(value: readonly T[] | T | undefined): readonly T[] {
  if (value === undefined) {
    return [];
  }
  return toArrayStrict(value);
}

export function resolveOutput<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
>(
  mapper:
    | Mapper<TContext, TExpressionEvent, unknown, EventObject>
    | NonReducibleUnknown,
  context: TContext,
  event: TExpressionEvent,
  self: AnyActor,
  input?: Record<string, unknown>
): unknown {
  if (typeof mapper === 'function') {
    const outputMapper = mapper as Mapper<
      TContext,
      TExpressionEvent,
      unknown,
      EventObject
    >;
    const args = {
      context,
      event,
      output: getEventOutput(event),
      self,
      input
    } as unknown as Parameters<typeof outputMapper>[0];

    return outputMapper(args);
  }

  if (
    isDevelopment &&
    !!mapper &&
    typeof mapper === 'object' &&
    Object.values(mapper).some((val) => typeof val === 'function')
  ) {
    console.warn(
      `Dynamically mapping values to individual properties is deprecated. Use a single function that returns the mapped object instead.\nFound object containing properties whose values are possibly mapping functions: ${Object.entries(
        mapper
      )
        .filter(([, value]) => typeof value === 'function')
        .map(
          ([key, value]) =>
            `\n - ${key}: ${(value as () => any)
              .toString()
              .replace(/\n\s*/g, '')}`
        )
        .join('')}`
    );
  }

  return mapper;
}

export function getEventOutput<TEvent extends EventObject>(
  event: TEvent
): OutputArg<TEvent>['output'] {
  if (
    event.type === 'xstate.done.actor' ||
    event.type === 'xstate.done.state'
  ) {
    const doneEvent = event as unknown as EventObject & { output: unknown };
    return doneEvent.output as OutputArg<TEvent>['output'];
  }

  return undefined as OutputArg<TEvent>['output'];
}

export function toTransitionConfigArray(
  configLike: SingleOrArray<
    AnyTransitionConfig | TransitionConfigTarget | AnyTransitionConfigFunction
  >
): Array<AnyTransitionConfig> {
  return toArrayStrict(configLike).map((transitionLike) => {
    if (
      typeof transitionLike === 'undefined' ||
      typeof transitionLike === 'string'
    ) {
      return { target: transitionLike };
    }

    if (typeof transitionLike === 'function') {
      return { to: transitionLike };
    }

    return transitionLike;
  });
}

export function normalizeTarget<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  target: SingleOrArray<string | StateNode<TContext, TEvent>> | undefined
): ReadonlyArray<string | StateNode<TContext, TEvent>> | undefined {
  if (target === undefined || target === TARGETLESS_KEY) {
    return undefined;
  }
  return toArray(target);
}

export function toObserver<T>(
  nextHandler?: Observer<T> | ((value: T) => void),
  errorHandler?: (error: any) => void,
  completionHandler?: () => void
): Observer<T> {
  const isObserver = typeof nextHandler === 'object';
  const self = isObserver ? nextHandler : undefined;

  return {
    next: (isObserver ? nextHandler.next : nextHandler)?.bind(self),
    error: (isObserver ? nextHandler.error : errorHandler)?.bind(self),
    complete: (isObserver ? nextHandler.complete : completionHandler)?.bind(
      self
    )
  };
}

export function resolveReferencedActor(machine: AnyStateMachine, src: string) {
  const match = src.match(/^xstate\.invoke\.(\d+)\.(.*)/)!;
  if (!match) {
    return machine.sources.actors[src];
  }
  const [, indexStr, nodeId] = match;
  const node = machine.getStateNodeById(nodeId);
  const invokeConfig = node.config.invoke!;
  const configSrc = (
    Array.isArray(invokeConfig)
      ? invokeConfig[indexStr as any]
      : (invokeConfig as InvokeConfig<
          any,
          any,
          any,
          any,
          any,
          any,
          any, // TEmitted
          any // TMeta
        >)
  ).src;
  // A referenced actor may itself be registered by name.
  return typeof configSrc === 'string'
    ? machine.sources.actors[configSrc]
    : configSrc;
}

export function getAllOwnEventDescriptors(snapshot: AnyMachineSnapshot) {
  return [...new Set([...snapshot.nodes.flatMap((sn) => sn.ownEvents)])];
}

/** @internal Events synthesized from active transition descriptors. */
export function getAllOwnEvents(snapshot: AnyMachineSnapshot) {
  const events = snapshot.nodes.flatMap((stateNode) =>
    [...stateNode.transitions.values()].flatMap((transitions) =>
      transitions.map((transition) => {
        const event: AnyEventObject = {
          type: transition.eventType,
          ...transition.matches
        };
        if (
          'actorId' in event &&
          (event.type === 'xstate.done.actor' ||
            event.type === 'xstate.error.actor' ||
            event.type === 'xstate.snapshot.actor' ||
            event.type === 'xstate.timeout.actor')
        ) {
          event.sessionId = snapshot.children[event.actorId]?.sessionId;
        }
        return event;
      })
    )
  );
  return events.filter(
    (event, index) =>
      events.findIndex((candidate) => {
        const keys = Object.keys(event);
        return (
          keys.length === Object.keys(candidate).length &&
          keys.every((key) => Object.is(event[key], candidate[key]))
        );
      }) === index
  );
}

export function matchesEvent(
  event: EventObject,
  pattern: Record<string, unknown>
): boolean {
  return Object.entries(pattern).every(([key, value]) =>
    Object.is((event as AnyEventObject)[key], value)
  );
}

/**
 * Checks if an event type matches an event descriptor, supporting wildcards.
 * Event descriptors can be:
 *
 * - Exact matches: "event.type"
 * - Wildcard: "*"
 * - Partial matches: "event.*"
 *
 * @param eventType - The actual event type string
 * @param descriptor - The event descriptor to match against
 * @returns True if the event type matches the descriptor
 */
export function matchesEventDescriptor(
  eventType: string,
  descriptor: string
): boolean {
  if (descriptor === eventType || descriptor === WILDCARD) {
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
  const eventTokens = eventType.split('.');

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
}
