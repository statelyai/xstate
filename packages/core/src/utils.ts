import isDevelopment from '#is-development';
import { isMachineSnapshot } from './State.ts';
import type { StateNode } from './StateNode.ts';
import { STATE_DELIMITER, TARGETLESS_KEY } from './constants.ts';
import type {
  ActorLogic,
  AnyActorRef,
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  AnyTransitionConfig,
  ErrorActorEvent,
  EventObject,
  InvokeConfig,
  MachineContext,
  Mapper,
  NonReducibleUnknown,
  Observer,
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

    return matchesState(parentStateValue[key], childStateValue[key]);
  });
}

export function toStatePath(stateId: string | string[]): string[] {
  if (isArray(stateId)) {
    return stateId;
  }

  return stateId.split(STATE_DELIMITER);
}

export function toStateValue(
  stateValue: StateLike<any> | StateValue
): StateValue {
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
    result[key] = iteratee(collection[key], key, collection, i);
  }

  return result;
}

export function toArrayStrict<T>(value: readonly T[] | T): readonly T[] {
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
  self: AnyActorRef
): unknown {
  if (typeof mapper === 'function') {
    return mapper({ context, event, self });
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
        .filter(([key, value]) => typeof value === 'function')
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

export function isActorLogic(value: any): value is ActorLogic<any, any> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'transition' in value &&
    typeof value.transition === 'function'
  );
}

export function isArray(value: any): value is readonly any[] {
  return Array.isArray(value);
}

export function isErrorActorEvent(
  event: AnyEventObject
): event is ErrorActorEvent {
  return event.type.startsWith('xstate.error.actor');
}

export function toTransitionConfigArray<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  configLike: SingleOrArray<AnyTransitionConfig | TransitionConfigTarget>
): Array<AnyTransitionConfig> {
  return toArrayStrict(configLike).map((transitionLike) => {
    if (
      typeof transitionLike === 'undefined' ||
      typeof transitionLike === 'string'
    ) {
      return { target: transitionLike };
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

export function createInvokeId(stateNodeId: string, index: number): string {
  return `${index}.${stateNodeId}`;
}

export function resolveReferencedActor(machine: AnyStateMachine, src: string) {
  const match = src.match(/^xstate\.invoke\.(\d+)\.(.*)/)!;
  if (!match) {
    return machine.implementations.actors[src];
  }
  const [, indexStr, nodeId] = match;
  const node = machine.getStateNodeById(nodeId);
  const invokeConfig = node.config.invoke!;
  return (
    Array.isArray(invokeConfig)
      ? invokeConfig[indexStr as any]
      : (invokeConfig as InvokeConfig<any, any, any, any, any, any>)
  ).src;
}

export function getAllOwnEventDescriptors(snapshot: AnyMachineSnapshot) {
  return [...new Set([...snapshot._nodes.flatMap((sn) => sn.ownEvents)])];
}
