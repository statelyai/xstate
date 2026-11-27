import { Deferred, Duration, Effect, Queue, Schema, Semaphore } from 'effect';
import { ClusterSchema, Entity } from 'effect/cluster';
import { Rpc } from 'effect/rpc';
import {
  createAsyncLogic,
  setup,
  types,
  type AnyEventObject,
  type TimerKey
} from 'xstate';
import { createDurable, type DurableCheckpoint } from 'xstate/durable';

const workflowView = Schema.Struct({
  state: Schema.String,
  revision: Schema.Int,
  result: Schema.NullOr(Schema.String)
});

export const ClusterWorkflow = Entity.make('XStateExampleWorkflow', [
  Rpc.make('Start', {
    payload: { requestId: Schema.NonEmptyString },
    success: workflowView,
    error: Schema.String
  }).annotate(ClusterSchema.Persisted, true),
  Rpc.make('Get', { success: workflowView, error: Schema.String })
]);

interface StoredWorkflow {
  machineId: string;
  machineVersion: string | undefined;
  requestId: string;
  checkpoint: DurableCheckpoint;
}

export interface WorkflowStore {
  load(entityId: string): Promise<StoredWorkflow | undefined>;
  /** Save the checkpoint and request ID in one compare-and-swap operation. */
  commit(
    entityId: string,
    expectedRevision: number | undefined,
    next: StoredWorkflow
  ): Promise<void>;
}

export interface WorkflowClock {
  now(): number;
  schedule(delay: number, fire: () => void): () => void;
}

const wallClock: WorkflowClock = {
  now: Date.now,
  schedule(delay, fire) {
    const timer = setTimeout(fire, delay);
    return () => clearTimeout(timer);
  }
};

const timerId = (timer: TimerKey) =>
  JSON.stringify(
    'id' in timer
      ? { id: timer.id }
      : 'seq' in timer
        ? { seq: timer.seq }
        : { event: timer.event }
  );

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function workflowLayer<R>(options: {
  store: WorkflowStore;
  work: (jobId: string) => Effect.Effect<string, unknown, R>;
  clock?: WorkflowClock;
}) {
  const { store, work, clock = wallClock } = options;
  return ClusterWorkflow.toLayer(
    Effect.gen(function* () {
      const { entityId } = yield* Entity.CurrentAddress;
      const context = yield* Effect.context<R>();
      const worker = new AbortController();
      const runPromise = Effect.runPromiseWith(context);
      const mailbox = yield* Queue.unbounded<AnyEventObject>();
      const initialized = yield* Deferred.make<void>();
      const permit = yield* Semaphore.make(1);
      const timers = new Map<string, () => void>();
      const running = new Set<Promise<unknown>>();
      const deferredStarts: Array<(committed: boolean) => void> = [];
      yield* Effect.addFinalizer(() =>
        Effect.promise(async () => {
          worker.abort();
          for (const cancel of timers.values()) cancel();
          timers.clear();
          for (const start of deferredStarts.splice(0)) start(false);
          await Promise.allSettled(running);
        })
      );

      const task = createAsyncLogic({
        run: ({ signal }) =>
          runPromise(work(entityId), {
            signal: AbortSignal.any([signal, worker.signal])
          })
      });
      const machine = setup({
        actors: { task },
        schemas: { events: { START: types<void>() } }
      }).createMachine({
        id: 'cluster-workflow',
        version: '1',
        context: { result: null as string | null },
        initial: 'idle',
        states: {
          idle: { on: { START: { target: 'working' } } },
          working: {
            invoke: {
              src: 'task',
              onDone: ({ event }) => ({
                target: 'waiting',
                context: { result: event.output }
              }),
              onError: { target: 'failed' }
            }
          },
          waiting: { after: { 1000: { target: 'completed' } } },
          completed: { type: 'final' },
          failed: { type: 'final' }
        }
      });

      const enqueue = (event: AnyEventObject) => {
        if (!worker.signal.aborted) Queue.offerUnsafe(mailbox, event);
      };
      const durable = createDurable(
        machine,
        {
          now: () => clock.now(),
          executeAction: () => {
            throw new Error(
              'The Cluster example does not support custom actions.'
            );
          },
          waitForEvent: () =>
            Effect.runPromise(Queue.take(mailbox), { signal: worker.signal }),
          enqueueRootEvent: (_source, event) => enqueue(event),
          runLogic: (_actor, exec) => {
            // Commit the active child before letting it produce a result.
            const promise = new Promise<unknown>((resolve, reject) => {
              deferredStarts.push((committed) => {
                if (committed && !worker.signal.aborted) {
                  Promise.resolve().then(exec).then(resolve, reject);
                } else {
                  reject(
                    new Error('The invocation was interrupted before starting.')
                  );
                }
              });
            });
            running.add(promise);
            void promise.then(
              () => running.delete(promise),
              () => running.delete(promise)
            );
            return promise;
          },
          scheduleTimer: (source, timer, delay) => {
            if (source.address !== durable.rootAddress) {
              throw new Error('The Cluster example only supports root timers.');
            }
            const key = timerId(timer);
            timers.get(key)?.();
            timers.set(
              key,
              clock.schedule(delay, () => {
                timers.delete(key);
                enqueue({ type: 'xstate.timer', ...timer });
              })
            );
          },
          cancelTimer: (_source, timer) => {
            const key = timerId(timer);
            timers.get(key)?.();
            timers.delete(key);
          }
        },
        { captureRootEvents: false }
      );

      type Step = ReturnType<typeof durable.initialTransition>;
      let snapshot: Step[0] | undefined;
      let stored: StoredWorkflow | undefined;
      let fault: string | undefined;

      async function apply([next, effects]: Step, requestId?: string) {
        let committed = false;
        try {
          await durable.executeEffects(effects);
          if (worker.signal.aborted) throw new Error('The worker stopped.');
          if (requestId !== undefined) {
            const record = {
              machineId: durable.machineId,
              machineVersion: durable.machineVersion,
              requestId,
              checkpoint: durable.checkpoint(next)
            };
            await store.commit(
              entityId,
              stored?.checkpoint.nextTransitionIndex,
              record
            );
            stored = record;
          }
          snapshot = next;
          committed = true;
        } finally {
          for (const start of deferredStarts.splice(0)) start(committed);
        }
        return next;
      }

      async function ready() {
        if (snapshot) return snapshot;
        stored = await store.load(entityId);
        if (
          stored &&
          (stored.machineId !== durable.machineId ||
            stored.machineVersion !== durable.machineVersion)
        ) {
          throw new Error(
            'The checkpoint belongs to a different machine version.'
          );
        }
        const state = await apply(
          stored
            ? durable.restore(stored.checkpoint)
            : durable.initialTransition()
        );
        Deferred.doneUnsafe(initialized, Effect.void);
        return state;
      }

      const operation = <A>(task: () => Promise<A>) =>
        permit.withPermit(
          Effect.uninterruptible(
            Effect.tryPromise({
              try: async () => {
                if (fault !== undefined) throw new Error(fault);
                return task();
              },
              catch: (error) => {
                fault = errorMessage(error);
                return fault;
              }
            })
          )
        );

      const view = (state: Step[0]) => ({
        state: String(state.value),
        revision: durable.nextTransitionIndex,
        result: state.context.result
      });

      yield* Deferred.await(initialized).pipe(
        Effect.andThen(
          Effect.forever(
            Effect.flatMap(
              Effect.promise(() => durable.waitForEvent()),
              (event) =>
                operation(async () => {
                  if (snapshot?.status === 'active' && stored) {
                    await apply(
                      durable.transition(snapshot, event),
                      stored.requestId
                    );
                  }
                })
            )
          )
        ),
        Effect.ignore,
        Effect.forkScoped
      );

      return ClusterWorkflow.of({
        Get: () => operation(async () => view(await ready())),
        Start: ({ payload: { requestId } }) =>
          operation(async () => {
            const current = await ready();
            if (stored) {
              return stored.requestId === requestId ? view(current) : undefined;
            }
            return view(
              await apply(
                durable.transition(current, { type: 'START' }),
                requestId
              )
            );
          }).pipe(
            Effect.flatMap((result) =>
              result
                ? Effect.succeed(result)
                : Effect.fail('This workflow already has a start request.')
            )
          )
      });
    }),
    { maxIdleTime: Duration.infinity }
  );
}
