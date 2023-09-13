export function isWrappable(obj: any): obj is object {
  let proto;
  return (
    obj != null &&
    typeof obj === 'object' &&
    (!(proto = Object.getPrototypeOf(obj)) ||
      proto === Object.prototype ||
      Array.isArray(obj))
  );
}

/**
 * Accepts any value and creates a deep clone if it is an object
 * This function only deeply clones objects, any classes with be copied
 * @param value The variable to deeply clone
 * @param valueRefs A WeakMap that stores a reference from the original
 * object/array to the cloned object/array
 */
const clone = <T extends unknown>(
  value: T,
  valueRefs: WeakMap<any, any>
): T => {
  if (!isWrappable(value)) {
    return value;
  }

  const isObject = !Array.isArray(value);

  // Get either a new object/array and a typed iterator
  const [clonedValue, keyedValues] = isObject
    ? [{} as T, Object.keys(value) as Array<keyof T>]
    : [[] as unknown as T, value as Array<keyof T>];

  // Save a reference of the object/array
  valueRefs.set(value, clonedValue);

  // Loop over all object/array indexes and clone
  for (let i = 0; i < keyedValues.length; ++i) {
    const keyedIndex = (isObject ? keyedValues[i] : i) as keyof T;
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

export const deepClone = <T extends unknown>(value: T): T =>
  clone(value, new WeakMap());
