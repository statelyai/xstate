import { State } from './State';
import { Event, StateValue, ActionType, Action, EventObject } from './types';

export function getEventType<TEvents extends EventObject = EventObject>(
  event: Event<TEvents>
): TEvents['type'] {
  try {
    return typeof event === 'string' || typeof event === 'number'
      ? `${event}`
      : (event as TEvents).type;
  } catch (e) {
    throw new Error(
      'Events must be strings or objects with a string event.type property.'
    );
  }
}
export function getActionType(action: Action<any>): ActionType {
  try {
    return typeof action === 'string' || typeof action === 'number'
      ? `${action}`
      : typeof action === 'function'
        ? action.name
        : action.type;
  } catch (e) {
    throw new Error(
      'Actions must be strings or objects with a string action.type property.'
    );
  }
}

export function toStatePath(
  stateId: string | string[],
  delimiter: string
): string[] {
  try {
    if (Array.isArray(stateId)) {
      return stateId;
    }

    return stateId.toString().split(delimiter);
  } catch (e) {
    throw new Error(`'${stateId}' is not a valid state path.`);
  }
}

export function toStateValue(
  stateValue: State<any> | StateValue | string[],
  delimiter: string
): StateValue {
  if (stateValue instanceof State) {
    return stateValue.value;
  }

  if (Array.isArray(stateValue)) {
    return pathToStateValue(stateValue);
  }

  if (typeof stateValue === 'object' && !(stateValue instanceof State)) {
    return stateValue;
  }

  const statePath = toStatePath(stateValue as string, delimiter);

  return pathToStateValue(statePath);
}

export function pathToStateValue(statePath: string[]): StateValue {
  if (statePath.length === 1) {
    return statePath[0];
  }

  const value = {};
  let marker = value;

  for (let i = 0; i < statePath.length - 1; i++) {
    if (i === statePath.length - 2) {
      marker[statePath[i]] = statePath[i + 1];
    } else {
      marker[statePath[i]] = {};
      marker = marker[statePath[i]];
    }
  }

  return value;
}

export function mapValues<T, P>(
  collection: { [key: string]: T },
  iteratee: (
    item: T,
    key: string,
    collection: { [key: string]: T },
    i: number
  ) => P
): { [key: string]: P } {
  const result = {};

  Object.keys(collection).forEach((key, i) => {
    result[key] = iteratee(collection[key], key, collection, i);
  });

  return result;
}

export function mapFilterValues<T, P>(
  collection: { [key: string]: T },
  iteratee: (item: T, key: string, collection: { [key: string]: T }) => P,
  predicate: (item: T) => boolean
): { [key: string]: P } {
  const result = {};

  Object.keys(collection).forEach(key => {
    const item = collection[key];

    if (!predicate(item)) {
      return;
    }

    result[key] = iteratee(item, key, collection);
  });

  return result;
}

/**
 * Retrieves a value at the given path.
 * @param props The deep path to the prop of the desired value
 */
export const path = <T extends Record<string, any>>(props: string[]): any => (
  object: T
): any => {
  let result: T = object;

  for (const prop of props) {
    result = result[prop as keyof typeof result];
  }

  return result;
};

/**
 * Retrieves a value at the given path via the nested accessor prop.
 * @param props The deep path to the prop of the desired value
 */
export function nestedPath<T extends Record<string, any>>(
  props: string[],
  accessorProp: keyof T
): (object: T) => T {
  return object => {
    let result: T = object;

    for (const prop of props) {
      result = result[accessorProp][prop];
    }

    return result;
  };
}

export const toStatePaths = (
  stateValue: StateValue | undefined
): string[][] => {
  if (!stateValue) {
    return [[]];
  }

  if (typeof stateValue === 'string') {
    return [[stateValue]];
  }

  const result = flatten(
    Object.keys(stateValue).map(key => {
      return toStatePaths(stateValue[key]).map(subPath => {
        return [key].concat(subPath);
      });
    })
  );

  return result;
};

export const pathsToStateValue = (paths: string[][]): StateValue => {
  const result: StateValue = {};

  if (paths && paths.length === 1 && paths[0].length === 1) {
    return paths[0][0];
  }

  for (const currentPath of paths) {
    let marker = result;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < currentPath.length; i++) {
      const subPath = currentPath[i];

      if (i === currentPath.length - 2) {
        marker[subPath] = currentPath[i + 1];
        break;
      }
      marker[subPath] = marker[subPath] || {};
      marker = marker[subPath] as {};
    }
  }

  return result;
};

export function flatten<T>(array: T[][]): T[] {
  return ([] as T[]).concat(...array);
}

export function stateValuesEqual(a: StateValue, b: StateValue): boolean {
  if (a === b) {
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every(key => stateValuesEqual(a[key], b[key]))
  );
}

export function toArray<T>(value: T[] | T | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined) {
    return [];
  }
  return [value];
}
