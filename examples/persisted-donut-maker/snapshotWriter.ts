import { writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/** Keep one active replacement and coalesce pending saves to the latest snapshot. */
export function createSnapshotWriter(filename: string) {
  let queued: string | undefined;
  let running: Promise<void> | undefined;
  let latest = Promise.resolve();

  async function drain() {
    let failed = false;
    let firstError: unknown;
    try {
      while (queued !== undefined) {
        const serialized = queued;
        queued = undefined;
        const temporary = `${filename}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, serialized, { flag: 'wx' });
          await rename(temporary, filename);
        } catch (error) {
          if (!failed) firstError = error;
          failed = true;
        } finally {
          await unlink(temporary).catch(() => {});
        }
      }
      if (failed) throw firstError;
    } finally {
      running = undefined;
    }
  }

  return {
    write(snapshot: unknown): Promise<void> {
      try {
        const serialized = JSON.stringify(snapshot);
        if (serialized === undefined)
          throw new TypeError('Snapshot must be JSON serializable');
        queued = serialized;
      } catch (error) {
        return Promise.reject(error);
      }
      if (!running) {
        running = drain();
        latest = running;
      }
      return running;
    },
    flush: () => running ?? latest
  };
}
