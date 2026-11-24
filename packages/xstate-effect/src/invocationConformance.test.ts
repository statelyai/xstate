import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import {
  createActor,
  createCallbackLogic,
  createMachine,
  setup,
  types,
  type ActorRefFrom,
  type InspectionEvent
} from 'xstate';
import { restoreActor } from 'xstate/persist';
import { createEffectActor, sendAndAwait } from './index.ts';

function workerFixture(
  queueRestartBeforeCompletion: () => void,
  record: (event: string) => void
) {
  let starts = 0;
  const resource = createCallbackLogic(() => {
    const run = ++starts;
    record(`start ${run}`);
    return () => record(`cleanup ${run}`);
  });
  const worker = setup({ actors: { resource } }).createMachine({
    schemas: { events: { FINISH: types<{ result: string }>() } },
    initial: 'running',
    states: {
      running: {
        invoke: { src: 'resource' },
        on: { FINISH: ({ event }) => ({ target: 'done', input: event.result }) }
      },
      done: {
        type: 'final',
        input: types<string>(),
        output: ({ input }) => input
      }
    },
    output: ({ event }) => event.output
  });
  return setup({ actors: { worker } }).createMachine({
    id: 'parent',
    schemas: {
      events: {
        RACE: types<void>(),
        RESTART: types<void>(),
        SYNC: types<void>()
      }
    },
    initial: 'working',
    context: { results: [] as string[] },
    states: {
      working: {
        invoke: {
          id: 'worker',
          src: 'worker',
          onDone: ({ context, event }) => ({
            target: 'completed',
            context: { results: [...context.results, event.output] }
          })
        },
        on: {
          RACE: (_, enq) => enq(queueRestartBeforeCompletion),
          RESTART: { target: 'working', reenter: true }
        }
      },
      completed: {}
    },
    on: { SYNC: {} }
  });
}

const timer = createMachine({
  initial: 'waiting',
  on: { SYNC: {} },
  states: {
    waiting: { after: { 1000: { target: 'expired' } } },
    expired: {}
  }
});

describe.each(['createActor', 'createEffectActor'] as const)(
  '%s lifecycle conformance',
  (host) => {
    it('ignores an already-queued completion from the replaced invocation', async () => {
      const order: string[] = [];
      let queueRace: () => void = () => {
        throw new Error('Expected the parent to be running');
      };
      const machine = workerFixture(
        () => queueRace(),
        () => {}
      );
      const inspect = (event: InspectionEvent) => {
        if (
          event.type === '@xstate.transition' &&
          'id' in event.actorRef &&
          event.actorRef.id === 'parent'
        ) {
          order.push(event.event.type);
        }
      };
      const exercise = Effect.fn(function* (
        actor: ActorRefFrom<typeof machine>,
        send: (type: 'RACE' | 'SYNC') => Effect.Effect<unknown, unknown>
      ) {
        const original = actor.getSnapshot().children.worker!;
        // The parent is processing RACE. Its mailbox receives RESTART before
        // the original live child sends its real completion notification.
        queueRace = () => {
          actor.send({ type: 'RESTART' });
          original.send({ type: 'FINISH', result: 'old' });
        };

        yield* send('RACE');
        yield* send('SYNC');
        expect(original.getSnapshot().status).toBe('done');
        expect(order).toEqual(
          expect.arrayContaining(['RESTART', 'xstate.done.actor'])
        );
        expect(order.indexOf('RESTART')).toBeLessThan(
          order.indexOf('xstate.done.actor')
        );
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('working');
        expect(snapshot.context.results).toEqual([]);
        const replacement = snapshot.children.worker!;
        expect(replacement).not.toBe(original);
        expect(replacement.getSnapshot().status).toBe('active');

        replacement.send({ type: 'FINISH', result: 'new' });
        yield* send('SYNC');
        expect(actor.getSnapshot().value).toBe('completed');
        expect(actor.getSnapshot().context.results).toEqual(['new']);
      });

      if (host === 'createActor') {
        const actor = createActor(machine, { inspect }).start();
        try {
          await Effect.runPromise(
            exercise(actor, (type) => Effect.sync(() => actor.send({ type })))
          );
        } finally {
          actor.stop();
        }
      } else {
        await Effect.runPromise(
          Effect.scoped(
            Effect.gen(function* () {
              const actor = yield* createEffectActor(machine);
              const subscription = actor.inspect(inspect);
              yield* Effect.addFinalizer(() =>
                Effect.sync(() => subscription.unsubscribe())
              );
              yield* exercise(actor, (type) => sendAndAwait(actor, { type }));
            })
          )
        );
      }
    });

    it('cleans up the invoked child before starting its replacement', async () => {
      const lifecycle: string[] = [];
      const machine = workerFixture(
        () => {},
        (event) => lifecycle.push(event)
      );

      if (host === 'createActor') {
        const actor = createActor(machine).start();
        try {
          actor.send({ type: 'RESTART' });
          expect(lifecycle).toEqual(['start 1', 'cleanup 1', 'start 2']);
        } finally {
          actor.stop();
        }
      } else {
        await Effect.runPromise(
          Effect.scoped(
            Effect.gen(function* () {
              const actor = yield* createEffectActor(machine);
              yield* sendAndAwait(actor, { type: 'RESTART' });
              expect(lifecycle).toEqual(['start 1', 'cleanup 1', 'start 2']);
            })
          )
        );
      }
      expect(lifecycle).toEqual([
        'start 1',
        'cleanup 1',
        'start 2',
        'cleanup 2'
      ]);
    });

    it('fires a restored timer at its original deadline after downtime', async () => {
      const downtime = 200;
      const justBeforeDeadline = 199;
      if (host === 'createActor') {
        // Native actors preserve deadlines with their default wall clock.
        vi.useFakeTimers();
        try {
          const actor = createActor(timer).start();
          vi.advanceTimersByTime(600);
          const persisted = actor.getPersistedSnapshot();
          actor.stop();
          vi.advanceTimersByTime(downtime);
          const restored = restoreActor(timer, persisted).start();
          try {
            vi.advanceTimersByTime(justBeforeDeadline);
            expect(restored.getSnapshot().value).toBe('waiting');
            vi.advanceTimersByTime(1);
            expect(restored.getSnapshot().value).toBe('expired');
          } finally {
            restored.stop();
          }
        } finally {
          vi.useRealTimers();
        }
      } else {
        await Effect.runPromise(
          Effect.gen(function* () {
            const persisted = yield* Effect.scoped(
              Effect.gen(function* () {
                const actor = yield* createEffectActor(timer);
                yield* sendAndAwait(actor, { type: 'SYNC' });
                yield* TestClock.adjust(600);
                return actor.getPersistedSnapshot();
              })
            );
            yield* TestClock.adjust(downtime);
            yield* Effect.scoped(
              Effect.gen(function* () {
                const restored = yield* createEffectActor(timer, {
                  snapshot: persisted
                });
                yield* sendAndAwait(restored, { type: 'SYNC' });
                yield* TestClock.adjust(justBeforeDeadline);
                const early = yield* sendAndAwait(restored, { type: 'SYNC' });
                expect(early.value).toBe('waiting');
                yield* TestClock.adjust(1);
                const due = yield* sendAndAwait(restored, { type: 'SYNC' });
                expect(due.value).toBe('expired');
              })
            );
          }).pipe(Effect.provide(TestClock.layer()))
        );
      }
    });
  }
);
