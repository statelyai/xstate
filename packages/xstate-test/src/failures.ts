import type {
  ModelTestFailure,
  TestFailureStore,
  TestFixture,
  TestStoredFailure
} from 'xstate/graph';

/** Options for the file-system failure database. See `failures`. */
export interface FailureDatabaseOptions {
  /** The directory failures are saved in. Defaults to `'.xstate-test'`. */
  readonly dir?: string;
  /**
   * `'first'` (the default) replays saved failures before the campaign and
   * fails on the first one that still reproduces. `'only'` replays them and
   * skips the campaign. `false` saves failures without replaying them.
   */
  readonly replay?: 'first' | 'only' | false;
  /**
   * The subdirectory of `dir` the failures of this test are saved in.
   * Defaults to the machine id plus a hash of the configured event cases and
   * oracles. Set it when two tests run the same machine with different
   * oracles, so each replays only its own failures.
   */
  readonly key?: string;
}

/** The accepted values of the `failures` option. */
export type FailuresOption =
  | boolean
  | FailureDatabaseOptions
  | TestFailureStore;

/** What a saved failure file contains. */
interface SavedFailure {
  readonly formatVersion: 1;
  readonly key: string;
  readonly summary: string;
  readonly replay?: unknown;
  readonly fixture: TestFixture;
}

const DEFAULT_DIR = '.xstate-test';

/** Keeps a key usable as a single directory name. */
function sanitizeKey(key: string): string {
  return (
    key.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'default'
  );
}

/**
 * A {@link TestFailureStore} that saves each failing fixture as
 * `<dir>/<key>/<hash>.json`. Node's `fs` is loaded only when a campaign reads
 * or writes a failure, so importing `@xstate/test` stays free of Node APIs.
 */
export function createFailureDatabase(
  options: FailureDatabaseOptions = {}
): TestFailureStore {
  const dir = options.dir ?? DEFAULT_DIR;
  const folderOf = async (key: string) => {
    const path = await import('node:path');
    return path.join(dir, sanitizeKey(key));
  };
  return {
    ...(options.key === undefined ? {} : { key: options.key }),
    replay: options.replay ?? 'first',
    load: async (key) => {
      const [fs, path] = await Promise.all([
        import('node:fs/promises'),
        import('node:path')
      ]);
      const folder = await folderOf(key);
      let names: string[];
      try {
        names = await fs.readdir(folder);
      } catch {
        return [];
      }
      const stored: TestStoredFailure[] = [];
      for (const name of names
        .filter((file) => file.endsWith('.json'))
        .sort()) {
        const location = path.join(folder, name);
        try {
          const saved = JSON.parse(await fs.readFile(location, 'utf8')) as
            | Partial<SavedFailure>
            | undefined;
          if (saved?.fixture) {
            stored.push({ fixture: saved.fixture, location });
          }
        } catch {
          // A file that is not a saved failure is left alone.
        }
      }
      return stored;
    },
    onFailure: async (fixture, key, failure: ModelTestFailure<any, any>) => {
      const [fs, path, crypto] = await Promise.all([
        import('node:fs/promises'),
        import('node:path'),
        import('node:crypto')
      ]);
      const folder = await folderOf(key);
      const serialized = JSON.stringify(fixture);
      const hash = crypto
        .createHash('sha256')
        .update(serialized)
        .digest('hex')
        .slice(0, 12);
      const location = path.join(folder, `${hash}.json`);
      const saved: SavedFailure = {
        formatVersion: 1,
        key,
        summary: failure.summary,
        ...(failure.replay ? { replay: failure.replay } : {}),
        fixture
      };
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(location, `${JSON.stringify(saved, null, 2)}\n`);
      return location;
    },
    remove: async (stored) => {
      if (!stored.location) {
        return;
      }
      const fs = await import('node:fs/promises');
      await fs.rm(stored.location, { force: true });
    }
  };
}

/** Turns the `failures` option into the store `xstate/graph` expects. */
export function resolveFailuresOption(
  failures: FailuresOption | undefined
): TestFailureStore | undefined {
  if (!failures) {
    return undefined;
  }
  if (failures === true) {
    return createFailureDatabase();
  }
  if (typeof (failures as TestFailureStore).load === 'function') {
    return failures as TestFailureStore;
  }
  return createFailureDatabase(failures as FailureDatabaseOptions);
}
