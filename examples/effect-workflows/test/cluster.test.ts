// @vitest-environment node
import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Deferred, Effect, Layer, ManagedRuntime } from 'effect';
import { TestRunner } from 'effect/cluster';
import { SimulatedClock } from 'xstate';
import {
  ClusterWorkflow,
  workflowLayer,
  type WorkflowStore
} from '../src/cluster.ts';

function diskStore(directory: string): WorkflowStore {
  const file = join(directory, 'checkpoint.json');
  function load(): Awaited<ReturnType<WorkflowStore['load']>> {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return undefined;
      throw error;
    }
  }
  return {
    load: async () => load(),
    async commit(_id, expected, next) {
      if (load()?.checkpoint.nextTransitionIndex !== expected) {
        throw new Error('Checkpoint revision changed.');
      }
      writeFileSync(file + '.tmp', JSON.stringify(next));
      renameSync(file + '.tmp', file);
    }
  };
}

it('resumes the work, deduplicates Start, and restores the deadline in a new Cluster runner', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'xstate-cluster-'));
  const simulated = new SimulatedClock();
  const clock = {
    now: () => simulated.now(),
    schedule(delay: number, fire: () => void) {
      const timer = simulated.setTimeout(fire, delay);
      return () => simulated.clearTimeout(timer);
    }
  };
  const firstStarted = Deferred.makeUnsafe<void>();
  const firstStopped = Deferred.makeUnsafe<void>();
  const retryStarted = Deferred.makeUnsafe<void>();
  const finish = Deferred.makeUnsafe<void>();
  const attempts: string[] = [];
  const openRunner = () =>
    ManagedRuntime.make(
      workflowLayer({
        store: diskStore(directory),
        clock,
        work: (jobId) =>
          Effect.gen(function* () {
            const record = yield* Effect.promise(() =>
              diskStore(directory).load(jobId)
            );
            expect(record?.requestId).toBe('request-1');
            attempts.push(jobId);
            if (attempts.length === 1) {
              yield* Deferred.succeed(firstStarted, undefined);
              return yield* Effect.never.pipe(
                Effect.onInterrupt(() =>
                  Deferred.succeed(firstStopped, undefined)
                )
              );
            }
            yield* Deferred.succeed(retryStarted, undefined);
            yield* Deferred.await(finish);
            return 'receipt';
          })
      }).pipe(Layer.provideMerge(TestRunner.layer))
    );

  const jobId = 'job-10';
  const request = { requestId: 'request-1' };
  const awaitSignal = (signal: Deferred.Deferred<void>) =>
    Effect.runPromise(Deferred.await(signal).pipe(Effect.timeout('3 seconds')));
  const start = Effect.flatMap(ClusterWorkflow.client, (client) =>
    client(jobId).Start(request)
  );
  const get = Effect.flatMap(ClusterWorkflow.client, (client) =>
    client(jobId).Get()
  );
  const first = openRunner();
  try {
    const started = await first.runPromise(start);
    expect(started.state).toBe('working');
    await awaitSignal(firstStarted);
    await first.dispose();
    await awaitSignal(firstStopped);

    const second = openRunner();
    try {
      expect(await second.runPromise(get)).toEqual(started);
      await awaitSignal(retryStarted);
      expect(await second.runPromise(start)).toEqual(started);
      const differentRequest = Effect.flatMap(
        ClusterWorkflow.client,
        (client) => client(jobId).Start({ requestId: 'request-2' })
      );
      await expect(second.runPromise(differentRequest)).rejects.toThrow(
        'This workflow already has a start request.'
      );
      expect(await second.runPromise(get)).toEqual(started);
      expect(attempts).toEqual([jobId, jobId]);

      await Effect.runPromise(Deferred.succeed(finish, undefined));
      await vi.waitFor(async () => {
        expect(await second.runPromise(get)).toEqual({
          state: 'waiting',
          revision: started.revision + 1,
          result: 'receipt'
        });
      });
      simulated.increment(400);
    } finally {
      await second.dispose();
    }

    simulated.increment(300);
    const third = openRunner();
    try {
      expect((await third.runPromise(get)).state).toBe('waiting');
      expect((await third.runPromise(start)).revision).toBe(
        started.revision + 1
      );
      simulated.increment(299);
      expect((await third.runPromise(get)).state).toBe('waiting');
      simulated.increment(1);
      await vi.waitFor(async () => {
        expect(await third.runPromise(get)).toEqual({
          state: 'completed',
          revision: started.revision + 2,
          result: 'receipt'
        });
      });
      expect(attempts).toEqual([jobId, jobId]);
    } finally {
      await third.dispose();
    }
  } finally {
    await first.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
