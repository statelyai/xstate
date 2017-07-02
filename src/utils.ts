function assoc(coll: {}, key: string, value: any) {
  if (coll[key] === value) {
    return coll;
  }

  const newColl = Object.assign({}, coll);

  newColl[key] = value;

  return newColl;
}

export function get(coll: {}, path: string[]): any {
  return path.reduce((acc, subPath) => {
    return acc[subPath];
  }, coll);
}

export function assocIn(coll: {}, path: string[], value: any) {
  const key0 = path[0];
  if (path.length === 1) {
    // simplest case is a 1-element array.  Just a simple assoc.
    return assoc(coll, key0, value);
  } else {
    // break the problem down.  Assoc this object with the first key
    // and the result of assocIn with the rest of the keys
    return assoc(coll, key0, assocIn(coll[key0] || {}, path.slice(1), value));
  }
}

export function flatMap<T, P>(collection: T[], iteratee: (item: T) => P): P[] {
  return collection.reduce((acc, item) => {
    const result = iteratee(item);

    if (Array.isArray(result)) {
      acc.push(...result);
    } else {
      acc.push(result);
    }

    return acc;
  }, []);
}
