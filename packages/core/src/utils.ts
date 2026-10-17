import isDevelopment from '#is-development';
import { isMachineSnapshot } from './State.ts';
import type { StateNode } from './StateNode.ts';
import { TARGETLESS_KEY, WILDCARD } from './constants.ts';
import type {
  AnyActor,
  AnyActorLogic,
  AnyEventObject,
  AnyInvokeDefinition,
  AnyMachineSnapshot,
  AnyStateMachine,
  AnyStateNode,
  AnyTransitionConfig,
  AnyTransitionConfigFunction,
  ErrorEvent,
  EventObject,
  MachineContext,
  Mapper,
  Observer,
  OutputArg,
  StateLike,
  StateValue
} from './types.ts';
import type { NonReducibleUnknown, SingleOrArray } from './typeUtils.ts';

/** @public */
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

/**
 * @internal Throws when a user source name (action, guard, actor or delay)
 * enters the `xstate.` / `@xstate.` namespaces, which are reserved for
 * built-in events, effects and source keys.
 */
export function assertUnreservedSourceName(kind: string, name: string): void {
  if (name.startsWith('xstate.') || name.startsWith('@xstate.')) {
    throw new Error(
      `Invalid ${kind} name '${name}': the 'xstate.' and '@xstate.' prefixes are reserved for built-in names.`
    );
  }
}

/** Whether a state key contains a `.` that is not escaped as `\\.`. */
export function hasUnescapedDot(key: string): boolean {
  for (let i = 0; i < key.length; i++) {
    if (key[i] === '\\') {
      i++;
    } else if (key[i] === '.') {
      return true;
    }
  }
  return false;
}

export function toStatePath(stateId: string | string[]): string[] {
  if (isArray(stateId)) {
    return stateId;
  }

  const result: string[] = [];
  let segment = '';

  for (let i = 0; i < stateId.length; i++) {
    const char = stateId.charCodeAt(i);
    switch (char) {
      // \
      case 92:
        // An escaped `.` stays escaped: `foo\\.bar` is one path segment, the
        // literal state key `'foo\\.bar'`. Other escapes consume the next
        // character.
        segment += stateId[i + 1] === '.' ? '\\.' : stateId[i + 1];
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

/** @internal */
function pathToStateValue(statePath: string[]): StateValue {
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

export function mapValues<P, O extends Record<string, unknown>>(
  collection: O,
  iteratee: (item: O[keyof O], key: keyof O, collection: O, i: number) => P
): { [key in keyof O]: P };
export function mapValues(
  collection: Record<string, unknown>,
  iteratee: (
    item: unknown,
    key: string,
    collection: Record<string, unknown>,
    i: number
  ) => unknown
) {
  const result: Record<string, unknown> = {};

  const collectionKeys = Object.keys(collection);
  for (let i = 0; i < collectionKeys.length; i++) {
    const key = collectionKeys[i];
    const value = iteratee(collection[key], key, collection, i);
    if (key === '__proto__') {
      Object.defineProperty(result, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      result[key] = value;
    }
  }

  return result;
}

function toArrayStrict<T>(value: readonly T[] | T): readonly T[] {
  if (isArray(value)) {
    return value;
  }
  return [value];
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
  if (isDoneEvent(event)) {
    const doneEvent = event as unknown as EventObject & { output: unknown };
    return doneEvent.output as OutputArg<TEvent>['output'];
  }

  return undefined as OutputArg<TEvent>['output'];
}

function isDoneEvent(event: EventObject): boolean {
  return (
    event.type === 'xstate.done.actor' || event.type === 'xstate.done.state'
  );
}

function isArray(value: any): value is readonly any[] {
  return Array.isArray(value);
}

export function isErrorEvent(event: AnyEventObject): event is ErrorEvent {
  return event.type.startsWith('xstate.error.');
}

/**
 * Normalizes authored transitions to config objects. A bare string target is
 * rejected (the types and `machineFromJSON` reject it too): `name` and
 * `stateId` locate it in the error.
 */
export function toTransitionConfigArray(
  configLike: SingleOrArray<AnyTransitionConfig | AnyTransitionConfigFunction>,
  name: string,
  stateId: string
): Array<AnyTransitionConfig> {
  return toArrayStrict(configLike).map((transitionLike) => {
    // Untyped (JS or JSON-parsed) configs can still contain a string.
    const value: unknown = transitionLike;
    if (typeof value === 'string') {
      throw new Error(
        `Transition for "${name}" in ${stateId ? `state "${stateId}"` : 'the root state'} is the string "${value}". Use { target: '${value}' }. The @xstate/codemod string-targets transform rewrites these.`
      );
    }
    if (typeof transitionLike === 'undefined') {
      return { target: undefined };
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

/** @experimental Used by framework integrations; not part of the stable API. */
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
    ),
    ...(isObserver && nextHandler.passive ? { passive: true } : {})
  };
}

/**
 * Names a machine in messages: `machine 'shop'`, or `the machine` when it
 * has no id.
 */
export function describeMachine(id: string): string {
  return id ? `machine '${id}'` : 'the machine';
}

/** The implicit id of an invoke: `<stateId>:<index>`, e.g. `loading:0`. */
export function createInvokeId(stateNodeId: string, index: number): string {
  return `${stateNodeId}:${index}`;
}

/** Whether `value` looks like an actor ref (as persisted context detects them). */
export function isActorRefLike(value: object): boolean {
  return 'sessionId' in value && 'send' in value && 'ref' in value;
}

/**
 * Resolves the logic of a persisted child that has no source key: an inline
 * invoke, identified by its id among the invoke definitions of the active
 * state nodes.
 */
export function resolveInvokedActorLogic(
  machine: AnyStateMachine,
  nodes: Iterable<AnyStateNode>,
  childId: string
): AnyActorLogic {
  const definitions: AnyInvokeDefinition[] = [];
  for (const node of nodes) {
    for (const definition of node.invoke) {
      if (definition.id === childId) {
        definitions.push(definition);
      }
    }
  }
  if (definitions.length !== 1) {
    throw new Error(
      `Unable to restore child actor '${childId}': it has no source key, and ${definitions.length ? 'several active states' : 'no active state'} of ${describeMachine(machine.id)} ${definitions.length ? 'invoke' : 'invokes'} it.`
    );
  }
  const logic = definitions[0].logic;
  if (typeof logic === 'string') {
    const registered = machine.sources.actors[logic];
    if (!registered) {
      throw new Error(
        `Unable to restore child actor '${childId}': child source '${logic}' is not provided in ${describeMachine(machine.id)}.`
      );
    }
    return registered;
  }
  if (typeof logic === 'function') {
    throw new Error(
      `Unable to restore child actor '${childId}': its invoke resolves \`src\` with a function that returned inline logic. Register the logic in \`actors\` and return its key so the child persists by source key.`
    );
  }
  return logic;
}

/**
 * Returns one event per transition of the active state nodes of `snapshot`,
 * including the internal events for invoked actors (`xstate.done.actor`,
 * `xstate.error.actor`) and delayed transitions (`xstate.after`). Graph
 * traversal sends these when the `events` option is not given.
 *
 * @public
 */
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
  if (descriptor === eventType) {
    return true;
  }

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
