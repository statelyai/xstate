/**
 * Returns the path of the first value in `value` that does not survive
 * `JSON.stringify` → `JSON.parse` (functions, symbols, bigints, non-finite
 * numbers, Maps, Sets, circular references), or `undefined`. Dates, actor refs
 * and `undefined` properties (omitted by JSON) are skipped.
 */
export function findNonJsonPath(
  value: unknown,
  path: string
): { path: string; kind: string } | undefined {
  const ancestors = new Set<object>();
  const visit = (
    current: unknown,
    currentPath: string
  ): { path: string; kind: string } | undefined => {
    switch (typeof current) {
      case 'function':
        return { path: currentPath, kind: 'function' };
      case 'symbol':
        return { path: currentPath, kind: 'symbol' };
      case 'bigint':
        return { path: currentPath, kind: 'bigint' };
      case 'number':
        // NaN and ±Infinity serialize as `null`.
        return Number.isFinite(current)
          ? undefined
          : { path: currentPath, kind: String(current) };
      case 'object':
        break;
      default:
        return undefined;
    }
    if (current === null || current instanceof Date) {
      return undefined;
    }
    if (current instanceof Map) {
      return { path: currentPath, kind: 'Map' };
    }
    if (current instanceof Set) {
      return { path: currentPath, kind: 'Set' };
    }
    if ('sessionId' in current && 'send' in current && 'ref' in current) {
      // Actor refs persist as `{ xstate$type: 'actorRef', id }`.
      return undefined;
    }
    if (ancestors.has(current)) {
      return { path: currentPath, kind: 'circular reference' };
    }
    ancestors.add(current);
    for (const key of Object.keys(current)) {
      const found = visit(
        (current as Record<string, unknown>)[key],
        Array.isArray(current)
          ? `${currentPath}[${key}]`
          : `${currentPath}.${key}`
      );
      if (found) {
        return found;
      }
    }
    ancestors.delete(current);
    return undefined;
  };
  return visit(value, path);
}
