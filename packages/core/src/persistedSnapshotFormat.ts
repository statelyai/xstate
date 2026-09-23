import type { Snapshot } from './types.ts';

/**
 * The persisted-snapshot envelope format written by this XState version.
 *
 * @remarks
 * Library-owned. Distinct from `machine.version`, which is the application's
 * own contract for its machine's states and context.
 *
 * @public
 */
export const PERSISTED_SNAPSHOT_FORMAT_VERSION = 1;

/**
 * Thrown when a persisted snapshot's `formatVersion` is missing or newer than
 * {@link PERSISTED_SNAPSHOT_FORMAT_VERSION}.
 *
 * @public
 */
export class PersistedSnapshotFormatError extends Error {
  override name = 'PersistedSnapshotFormatError';
  /** The `formatVersion` read from the snapshot, if any. */
  readonly formatVersion: unknown;
  constructor(message: string, formatVersion: unknown) {
    super(message);
    this.formatVersion = formatVersion;
  }
}

/**
 * Upgrades a persisted machine snapshot to the current envelope format
 * ({@link PERSISTED_SNAPSHOT_FORMAT_VERSION}).
 *
 * @remarks
 * Only format 1 exists; this validates `formatVersion` and returns the snapshot
 * unchanged. Future library-owned format changes are upgraded here.
 * Application-owned changes (`machine.version`) go through `migrate` or
 * `machineVersions().migrateSnapshot()`.
 *
 * @throws {PersistedSnapshotFormatError} If `formatVersion` is missing or newer
 *   than this XState version supports.
 * @public
 */
export function upgradePersistedSnapshot<T extends Snapshot<unknown>>(
  snapshot: T
): T {
  const formatVersion = (snapshot as { formatVersion?: unknown } | undefined)
    ?.formatVersion;
  if (formatVersion === undefined) {
    throw new PersistedSnapshotFormatError(
      'Persisted snapshot has no `formatVersion`: it predates the XState v6 beta snapshot format and no upgrade path exists.',
      formatVersion
    );
  }
  if (
    typeof formatVersion !== 'number' ||
    !Number.isInteger(formatVersion) ||
    formatVersion < 1
  ) {
    throw new PersistedSnapshotFormatError(
      `Persisted snapshot has invalid \`formatVersion\` ${JSON.stringify(formatVersion)}.`,
      formatVersion
    );
  }
  if (formatVersion > PERSISTED_SNAPSHOT_FORMAT_VERSION) {
    throw new PersistedSnapshotFormatError(
      `Persisted snapshot \`formatVersion\` ${formatVersion} is newer than this XState version supports (${PERSISTED_SNAPSHOT_FORMAT_VERSION}).`,
      formatVersion
    );
  }
  return snapshot;
}

/**
 * Returns the path of the first value in `value` that does not survive
 * `JSON.stringify` → `JSON.parse` (functions, symbols, bigints, Maps, Sets,
 * circular references), or `undefined`. Dates and actor refs are skipped.
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
