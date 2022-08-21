import type { SetStoreFunction } from 'solid-js/store';
import { reconcile } from 'solid-js/store';

function isObject(payload: any): payload is object {
  return payload && typeof payload === 'object' && !Array.isArray(payload);
}

function isNonObjectPrototype(payload: any): payload is object {
  return payload?.constructor?.name && payload.constructor.name !== 'Object';
}

export const spreadIfObject = <T>(value: T): T =>
  isObject(value) ? { ...value } : value;

/**
 * Reconcile the state of the machine with the current state of the store.
 * Handles primitive values, arrays, and objects.
 * Provides granular reactivity for the state of the machine in SolidJS.
 * @param nextState The next state value to update current store with
 * @param setState A Solid store setter
 */
export function updateState<NextState extends object | unknown>(
  nextState: NextState,
  setState: SetStoreFunction<NextState>
): void {
  if (isObject(nextState)) {
    const keys = Object.keys(nextState) as any[];

    for (const key of keys) {
      // Don't update functions
      if (typeof nextState[key] === 'function') {
        continue;
      }

      // Try to reconcile and fall back to replacing state
      try {
        setState(key, reconcile(nextState[key]));
      } catch {
        setState(key, nextState[key]);
      }
    }
  } else {
    setState(nextState);
  }
}

/**
 * Accepts any value and creates a deep clone if it is an object
 * This function only deeply clones objects, any classes with be copied
 * @param value The variable to deeply clone
 * @param objectRefs An array that stores a reference to the properties in the original object
 * @param clonedObjectRefs An array that stores a reference to cloned
 */
const clone = <T>(value: T, objectRefs: any[], clonedObjectRefs: any[]): T => {
  if (!isObject(value)) {
    return value;
  }

  // Save a reference of the object
  objectRefs.push(value);

  // If the value is a class or non object prototype, copy over instead of cloning
  if (isNonObjectPrototype(value)) {
    return value;
  }

  const clonedObject: T = {} as T;
  clonedObjectRefs.push(clonedObject);

  // Loop over all values in object and clone
  for (const [key, currentObj] of Object.entries(value)) {
    if (isObject(currentObj)) {
      // Check if reference already exists, helps prevent max call stack
      const refIndex = objectRefs.indexOf(currentObj);
      if (refIndex !== -1) {
        clonedObject[key] = clonedObjectRefs[refIndex];
      } else {
        if (isNonObjectPrototype(currentObj)) {
          clonedObject[key] = currentObj;
        } else {
          clonedObject[key] = clone(currentObj, objectRefs, clonedObjectRefs);
        }
      }
    } else {
      clonedObject[key] = currentObj;
    }
  }

  return clonedObject;
};

export const deepClone = <T>(value: T): T => clone(value, [], []);
