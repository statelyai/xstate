import State from "./State";
import { Action, StateValue } from "./types";

export function getActionType(action: Action): string {
  try {
    return typeof action === "string" || typeof action === "number"
      ? `${action}`
      : action.type;
  } catch (e) {
    throw new Error(
      "Actions must be strings or objects with a string action.type."
    );
  }
}

export function toStatePath(stateId: string | string[]): string[] {
  try {
    if (Array.isArray(stateId)) {
      return stateId;
    }

    return stateId.toString().split(".");
  } catch (e) {
    throw new Error(`'${stateId}' is not a valid state path.`);
  }
}

export function toTrie(stateValue: StateValue): StateValue {
  if (typeof stateValue === "object" && !(stateValue instanceof State)) {
    return stateValue;
  }

  const statePath = toStatePath(stateValue as string);
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
  iteratee: (item: T, key: string, collection: { [key: string]: T }) => P
): { [key: string]: P } {
  const result = {};

  Object.keys(collection).forEach(key => {
    result[key] = iteratee(collection[key], key, collection);
  });

  return result;
}
