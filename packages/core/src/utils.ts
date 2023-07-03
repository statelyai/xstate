import isDevelopment from '#is-development';
import { AnyActorLogic, AnyState } from './index.ts';
import { errorExecution, errorPlatform } from './actionTypes.ts';
import { NULL_EVENT, STATE_DELIMITER, TARGETLESS_KEY } from './constants.ts';
import type { StateNode } from './StateNode.ts';
import type {
  ActorLogic,
  AnyEventObject,
  EventObject,
  EventType,
  InvokeConfig,
  MachineContext,
  Mapper,
  Observer,
  PropertyMapper,
  ErrorEvent,
  SingleOrArray,
  StateLike,
  StateValue,
  Subscribable,
  TransitionConfig,
  TransitionConfigTarget,
  TODO
} from './types.ts';

export function keys<T extends object>(value: T): Array<keyof T & string> {
  return Object.keys(value) as Array<keyof T & string>;
}

export function matchesState(
  parentStateId: StateValue,
  childStateId: StateValue
): boolean {
  const parentStateValue = toStateValue(parentStateId);
  const childStateValue = toStateValue(childStateId);

  if (isString(childStateValue)) {
    if (isString(parentStateValue)) {
      return childStateValue === parentStateValue;
    }

    // Parent more specific than child
    return false;
  }

  if (isString(parentStateValue)) {
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
  try {
    if (isArray(stateId)) {
      return stateId;
    }

    return stateId.toString().split(STATE_DELIMITER);
  } catch (e) {
    throw new Error(`'${stateId}' is not a valid state path.`);
  }
}

export function isStateLike(state: any): state is AnyState {
  return (
    typeof state === 'object' &&
    'value' in state &&
    'context' in state &&
    'event' in state
  );
}

export function toStateValue(
  stateValue: StateLike<any> | StateValue | string[]
): StateValue {
  if (isStateLike(stateValue)) {
    return stateValue.value;
  }

  if (isArray(stateValue)) {
    return pathToStateValue(stateValue);
  }

  if (typeof stateValue !== 'string') {
    return stateValue as StateValue;
  }

  const statePath = toStatePath(stateValue as string);

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

export function mapFilterValues<T, P>(
  collection: { [key: string]: T },
  iteratee: (item: T, key: string, collection: { [key: string]: T }) => P,
  predicate: (item: T) => boolean
): { [key: string]: P } {
  const result: { [key: string]: P } = {};

  for (const key of Object.keys(collection)) {
    const item = collection[key];

    if (!predicate(item)) {
      continue;
    }

    result[key] = iteratee(item, key, collection);
  }

  return result;
}

/**
 * Retrieves a value at the given path.
 * @param props The deep path to the prop of the desired value
 */
export function path<T extends Record<string, any>>(props: string[]): any {
  return (object: T): any => {
    let result: T = object;

    for (const prop of props) {
      result = result[prop as keyof typeof result];
    }

    return result;
  };
}

export function toStatePaths(stateValue: StateValue | undefined): string[][] {
  if (!stateValue) {
    return [[]];
  }

  if (isString(stateValue)) {
    return [[stateValue]];
  }

  const result = flatten(
    Object.keys(stateValue).map((key) => {
      const subStateValue = stateValue[key];

      if (
        typeof subStateValue !== 'string' &&
        (!subStateValue || !Object.keys(subStateValue).length)
      ) {
        return [[key]];
      }

      return toStatePaths(stateValue[key]).map((subPath) => {
        return [key].concat(subPath);
      });
    })
  );

  return result;
}

export function flatten<T>(array: Array<T | T[]>): T[] {
  return ([] as T[]).concat(...array);
}

export function toArrayStrict<T>(value: T[] | T): T[] {
  if (isArray(value)) {
    return value;
  }
  return [value];
}

export function toArray<T>(value: T[] | T | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return toArrayStrict(value);
}

export function mapContext<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  mapper: Mapper<TContext, TEvent, any> | PropertyMapper<TContext, TEvent, any>,
  context: TContext,
  event: TEvent
): any {
  if (isFunction(mapper)) {
    return mapper({ context, event });
  }

  const result = {} as any;
  const args = { context, event };

  for (const key of Object.keys(mapper)) {
    const subMapper = mapper[key];

    if (isFunction(subMapper)) {
      result[key] = subMapper(args);
    } else {
      result[key] = subMapper;
    }
  }

  return result;
}

export function isBuiltInEvent(eventType: EventType): boolean {
  return /^(done|error)\./.test(eventType);
}

export function isPromiseLike(value: any): value is PromiseLike<any> {
  if (value instanceof Promise) {
    return true;
  }
  // Check if shape matches the Promise/A+ specification for a "thenable".
  if (
    value !== null &&
    (isFunction(value) || typeof value === 'object') &&
    isFunction(value.then)
  ) {
    return true;
  }
  return false;
}

export function isActorLogic(value: any): value is ActorLogic<any, any> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'transition' in value &&
    typeof value.transition === 'function'
  );
}

export function partition<T, A extends T, B extends T>(
  items: T[],
  predicate: (item: T) => item is A
): [A[], B[]] {
  const [truthy, falsy] = [[], []] as [A[], B[]];

  for (const item of items) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item as B);
    }
  }

  return [truthy, falsy];
}

export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

// tslint:disable-next-line:ban-types
export function isFunction(value: any): value is Function {
  return typeof value === 'function';
}

export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isObservable<T>(value: any): value is Subscribable<T> {
  try {
    return 'subscribe' in value && isFunction(value.subscribe);
  } catch (e) {
    return false;
  }
}

export const uniqueId = (() => {
  let currentId = 0;

  return () => {
    currentId++;
    return currentId.toString(16);
  };
})();

export function isErrorEvent(event: AnyEventObject): event is ErrorEvent<any> {
  return (
    typeof event.type === 'string' &&
    (event.type === errorExecution || event.type.startsWith(errorPlatform))
  );
}

export function toTransitionConfigArray<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  event: TEvent['type'] | typeof NULL_EVENT | '*',
  configLike: SingleOrArray<
    TransitionConfig<TContext, TEvent> | TransitionConfigTarget
  >
): Array<
  TransitionConfig<TContext, TEvent> & {
    event: TEvent['type'] | typeof NULL_EVENT | '*';
  }
> {
  const transitions = toArrayStrict(configLike).map((transitionLike) => {
    if (
      typeof transitionLike === 'undefined' ||
      typeof transitionLike === 'string'
    ) {
      return { target: transitionLike, event };
    }

    return { ...transitionLike, event };
  }) as Array<
    TransitionConfig<TContext, TEvent> & {
      event: TEvent['type'] | typeof NULL_EVENT | '*';
    } // TODO: fix 'as' (remove)
  >;

  return transitions;
}

export function normalizeTarget<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  target: SingleOrArray<string | StateNode<TContext, TEvent>> | undefined
): Array<string | StateNode<TContext, TEvent>> | undefined {
  if (target === undefined || target === TARGETLESS_KEY) {
    return undefined;
  }
  return toArray(target);
}

export function reportUnhandledExceptionOnInvocation(
  originalError: any,
  currentError: any,
  id: string
) {
  if (isDevelopment) {
    const originalStackTrace = originalError.stack
      ? ` Stacktrace was '${originalError.stack}'`
      : '';
    if (originalError === currentError) {
      // tslint:disable-next-line:no-console
      console.error(
        `Missing onError handler for invocation '${id}', error was '${originalError}'.${originalStackTrace}`
      );
    } else {
      const stackTrace = currentError.stack
        ? ` Stacktrace was '${currentError.stack}'`
        : '';
      // tslint:disable-next-line:no-console
      console.error(
        `Missing onError handler and/or unhandled exception/promise rejection for invocation '${id}'. ` +
          `Original error: '${originalError}'. ${originalStackTrace} Current error is '${currentError}'.${stackTrace}`
      );
    }
  }
}

export function toInvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  invocable: InvokeConfig<TContext, TEvent, TODO> | string | AnyActorLogic,
  id: string
): InvokeConfig<TContext, TEvent, TODO> {
  if (typeof invocable === 'object') {
    if ('src' in invocable) {
      return invocable;
    }

    if ('transition' in invocable) {
      return {
        id,
        src: invocable
      };
    }
  }

  return {
    id,
    src: invocable
  };
}

export function toObserver<T>(
  nextHandler?: Observer<T> | ((value: T) => void),
  errorHandler?: (error: any) => void,
  completionHandler?: () => void
): Observer<T> {
  const noop = () => {};
  const isObserver = typeof nextHandler === 'object';
  const self = isObserver ? nextHandler : null;

  return {
    next: ((isObserver ? nextHandler.next : nextHandler) || noop).bind(self),
    error: ((isObserver ? nextHandler.error : errorHandler) || noop).bind(self),
    complete: (
      (isObserver ? nextHandler.complete : completionHandler) || noop
    ).bind(self)
  };
}

export function createInvokeId(stateNodeId: string, index: number): string {
  return `${stateNodeId}:invocation[${index}]`;
}

export function resolveReferencedActor(
  referenced:
    | AnyActorLogic
    | { src: AnyActorLogic; input: Mapper<any, any, any> | any }
    | undefined
) {
  return referenced
    ? 'transition' in referenced
      ? { src: referenced, input: undefined }
      : referenced
    : undefined;
}
