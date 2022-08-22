function isObject(value: any): value is object {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isNonObjectPrototype(value: any): value is object {
  return value?.constructor?.name && value.constructor.name !== 'Object';
}

/**
 * Accepts any value and creates a deep clone if it is an object
 * This function only deeply clones objects, any classes with be copied
 * @param value The variable to deeply clone
 * @param objectRefs An array that stores a reference to the properties in the original object
 * @param clonedObjectRefs An array that stores a reference to cloned
 */
const clone = <T>(
  value: T,
  objectRefs: unknown[],
  clonedObjectRefs: unknown[]
): T => {
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
