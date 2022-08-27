function isObjectOrArray(value: any): value is object {
  return value && typeof value === 'object';
}

function isNonObjectPrototype(value: any): value is object {
  return (
    value?.constructor?.name &&
    value.constructor.name !== 'Object' &&
    value.constructor.name !== 'Array'
  );
}

/**
 * Accepts any value and creates a deep clone if it is an object
 * This function only deeply clones objects, any classes with be copied
 * @param value The variable to deeply clone
 * @param valueRefs A WeakMap that stores a reference from the original
 * object/array to the cloned object/array
 */
const clone = <T>(value: T, valueRefs: WeakMap<any, any>): T => {
  if (!isObjectOrArray(value)) {
    return value;
  }

  // If the value is a class or non object/array prototype, copy over instead of cloning
  if (isNonObjectPrototype(value)) {
    return value;
  }

  const isObject = !Array.isArray(value);

  // Get either a new object/array and a typed iterator
  const [clonedValue, keyedValues]: [T, Array<keyof T | any>] = isObject
    ? [{} as T, Object.keys(value)]
    : [([] as unknown) as T, value];

  // Save a reference of the object/array
  valueRefs.set(value, clonedValue);

  // Loop over all object/array indexes and clone
  for (let i = 0; i < keyedValues.length; ++i) {
    const keyedIndex = isObject ? keyedValues[i] : i;
    const currentVal = value[keyedIndex];
    // Check if reference already exists, helps prevent max call stack
    if (valueRefs.has(currentVal)) {
      clonedValue[keyedIndex] = valueRefs.get(currentVal);
    } else {
      clonedValue[keyedIndex] = clone(currentVal, valueRefs);
    }
  }

  return clonedValue;
};

export const deepClone = <T>(value: T): T => clone(value, new WeakMap());
