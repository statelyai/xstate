import {
  Event,
  StateValue,
  ActionType,
  Action,
  EventObject,
  StateInterface,
  PropertyMapper,
  Mapper,
  EventType,
  ActionTypes,
  HistoryValue,
  OmniEventObject,
  AssignAction
} from './types';
import { STATE_DELIMITER } from './constants';

function isState(state: object | string): state is StateInterface {
  if (typeof state === 'string') {
    return false;
  }

  return 'value' in state && 'tree' in state && 'history' in state;
}

export function keys<T extends object>(value: T): Array<keyof T & string> {
  return Object.keys(value) as Array<keyof T & string>;
}

export function matchesState(
  parentStateId: StateValue,
  childStateId: StateValue,
  delimiter: string = STATE_DELIMITER
): boolean {
  const parentStateValue = toStateValue(parentStateId, delimiter);
  const childStateValue = toStateValue(childStateId, delimiter);

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

  return keys(parentStateValue).every(key => {
    if (!(key in childStateValue)) {
      return false;
    }

    return matchesState(parentStateValue[key], childStateValue[key]);
  });
}

export function getEventType<TEvent extends EventObject = EventObject>(
  event: Event<TEvent>
): TEvent['type'] {
  try {
    return typeof event === 'string' || typeof event === 'number'
      ? `${event}`
      : (event as TEvent).type;
  } catch (e) {
    throw new Error(
      'Events must be strings or objects with a string event.type property.'
    );
  }
}
export function getActionType(action: Action<any, any>): ActionType {
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
  stateValue: StateInterface<any> | StateValue | string[],
  delimiter: string
): StateValue {
  if (isState(stateValue)) {
    return stateValue.value;
  }

  if (Array.isArray(stateValue)) {
    return pathToStateValue(stateValue);
  }

  if (typeof stateValue !== 'string' && !isState(stateValue)) {
    return stateValue as StateValue;
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

  keys(collection).forEach((key, i) => {
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

  keys(collection).forEach(key => {
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
    keys(stateValue).map(key => {
      const subStateValue = stateValue[key];

      if (
        typeof subStateValue !== 'string' &&
        !Object.keys(subStateValue).length
      ) {
        return [[key]];
      }

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

export function toArray<T>(value: T[] | T | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined) {
    return [];
  }
  return [value];
}

export function mapContext<TContext, TEvent extends EventObject>(
  mapper: Mapper<TContext, TEvent> | PropertyMapper<TContext, TEvent>,
  context: TContext,
  event: TEvent
): any {
  if (typeof mapper === 'function') {
    return (mapper as Mapper<TContext, TEvent>)(context, event);
  }

  const result = {} as any;

  for (const key of keys(mapper)) {
    const subMapper = mapper[key];

    if (typeof subMapper === 'function') {
      result[key] = subMapper(context, event);
    } else {
      result[key] = subMapper;
    }
  }

  return result;
}

export function isBuiltInEvent(eventType: EventType): boolean {
  // check if event is a "done" event
  if (
    eventType.indexOf(ActionTypes.DoneState) === 0 ||
    eventType.indexOf(ActionTypes.DoneInvoke) === 0
  ) {
    return true;
  }

  // check if event is an "error" event
  if (
    eventType === ActionTypes.ErrorCommunication ||
    eventType === ActionTypes.ErrorCommunication
  ) {
    return true;
  }

  return false;
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

export function updateHistoryStates(
  hist: HistoryValue,
  stateValue: StateValue
): Record<string, HistoryValue | undefined> {
  return mapValues(hist.states, (subHist, key) => {
    if (!subHist) {
      return undefined;
    }
    const subStateValue =
      (typeof stateValue === 'string' ? undefined : stateValue[key]) ||
      (subHist ? subHist.current : undefined);

    if (!subStateValue) {
      return undefined;
    }

    return {
      current: subStateValue,
      states: updateHistoryStates(subHist, subStateValue)
    };
  });
}

export function updateHistoryValue(
  hist: HistoryValue,
  stateValue: StateValue
): HistoryValue {
  return {
    current: stateValue,
    states: updateHistoryStates(hist, stateValue)
  };
}

export function updateContext<TContext, TEvent extends EventObject>(
  context: TContext,
  event: OmniEventObject<TEvent>,
  assignActions: Array<AssignAction<TContext, TEvent>>
): TContext {
  const updatedContext = context
    ? assignActions.reduce((acc, assignAction) => {
        const { assignment } = assignAction as AssignAction<
          TContext,
          OmniEventObject<TEvent>
        >;

        let partialUpdate: Partial<TContext> = {};

        if (typeof assignment === 'function') {
          partialUpdate = assignment(acc, event || { type: ActionTypes.Init });
        } else {
          keys(assignment).forEach(key => {
            const propAssignment = assignment[key];

            partialUpdate[key] =
              typeof propAssignment === 'function'
                ? propAssignment(acc, event)
                : propAssignment;
          });
        }

        return Object.assign({}, acc, partialUpdate);
      }, context)
    : context;

  return updatedContext;
}
