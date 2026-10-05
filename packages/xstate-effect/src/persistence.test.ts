import { Clock, Duration, Effect, Exit, Layer, Scope, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import fc from 'fast-check';
import {
  createMachine,
  createObservableLogic,
  setup,
  types,
  type AnyActorLogic,
  type Snapshot
} from 'xstate';
import { getShortestPaths } from 'xstate/graph';
import {
  createEffectActor,
  fromEffect,
  fromEffectStream,
  join,
  waitFor,
  type EffectActor
} from './index.ts';

/** Persists like a host would: through JSON, into a different process. */
const roundTrip = (snapshot: Snapshot<unknown>): Snapshot<unknown> =>
  JSON.parse(JSON.stringify(snapshot));

/**
 * Polls until `predicate` holds. Effects run on detached fibers, so tests wait
 * for the condition they assert on instead of for a fixed number of ticks.
 */
const until = (predicate: () => boolean, timeoutMs = 1000) =>
  Effect.promise(async () => {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
      if (Date.now() > deadline) {
        throw new Error('Timed out waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  });

/**
 * A `TestClock` that reports the sleeps it is holding, so a test can advance
 * time only once an actor's timers and tasks are actually waiting on it.
 */
const recordingClock = () => {
  const state = { pending: 0, requested: [] as number[] };
  const layer = Layer.effect(
    Clock.Clock,
    Effect.map(TestClock.make(), (clock) => ({
      ...clock,
      sleep: (duration: Duration.Duration) =>
        Effect.suspend(() => {
          state.pending++;
          state.requested.push(Duration.toMillis(duration));
          return clock.sleep(duration);
        }).pipe(Effect.ensuring(Effect.sync(() => state.pending--)))
    }))
  );
  return { state, layer };
};

/** Counts side effects across one run, including across a restore. */
const tally = { entries: 0, expired: 0, ready: 0, fetches: 0 };

const counter = createMachine({
  context: { count: 0 },
  on: {
    inc: ({ context, parent }, enq) => {
      const count = context.count + 1;
      const counted = { type: 'counted', count };
      enq.sendTo(parent!, counted);
      return { context: { count } };
    }
  }
});

const fetchReport = fromEffect(
  Effect.gen(function* () {
    tally.fetches++;
    yield* Effect.sleep('1 second');
    return 'report';
  })
);

type Command = 'NEXT' | 'BACK' | 'FETCH' | 'PING' | 'TICK';

const record = <T extends string>(target: T) => ({
  target,
  context: ({
    context,
    event
  }: {
    context: Context;
    event: { type: string };
  }) => ({ ...context, trail: context.trail + event.type[0] })
});

type Context = {
  trail: string;
  sent: number;
  counted: number;
  syncs: number;
  report: string;
};

/**
 * Parallel and nested states, a delayed transition, an invoked machine child
 * that keeps its own count, and an Effect task that needs the clock.
 */
const model = createMachine({
  id: 'model',
  actors: { counter, fetchReport },
  schemas: {
    events: {
      NEXT: types<{}>(),
      BACK: types<{}>(),
      FETCH: types<{}>(),
      PING: types<{}>(),
      SYNC: types<{}>(),
      counted: types<{ count: number }>()
    }
  },
  context: {
    trail: '',
    sent: 0,
    counted: 0,
    syncs: 0,
    report: ''
  } as Context,
  entry: () => {
    tally.entries++;
  },
  invoke: { src: 'counter', id: 'counter' },
  on: {
    PING: ({ context, children }, enq) => {
      if (context.sent >= 2) {
        return;
      }
      enq.sendTo(children.counter!, { type: 'inc' });
      return {
        context: {
          ...context,
          trail: context.trail + 'P',
          sent: context.sent + 1
        }
      };
    },
    counted: ({ context, event }) => ({
      context: { ...context, counted: event.count }
    }),
    // A mailbox barrier: once it is processed, every earlier event has been.
    SYNC: ({ context }) => ({
      context: { ...context, syncs: context.syncs + 1 }
    })
  },
  type: 'parallel',
  states: {
    flow: {
      initial: 'idle',
      states: {
        idle: { on: { NEXT: record('working') } },
        working: {
          initial: 'one',
          on: { BACK: record('idle') },
          states: { one: { on: { NEXT: record('two') } }, two: {} }
        }
      }
    },
    report: {
      initial: 'waiting',
      states: {
        waiting: { on: { FETCH: record('fetching') } },
        fetching: {
          invoke: {
            src: 'fetchReport',
            onDone: {
              target: 'ready',
              context: ({ context, event }) => ({
                ...context,
                report: event.output
              })
            }
          }
        },
        ready: {
          entry: () => {
            tally.ready++;
          }
        }
      }
    },
    timer: {
      initial: 'armed',
      states: {
        armed: { after: { 2000: { target: 'expired' } } },
        expired: {
          entry: () => {
            tally.expired++;
          }
        }
      }
    }
  }
});

type ModelActor = EffectActor<typeof model>;
type Recording = ReturnType<typeof recordingClock>['state'];

/**
 * Waits until the actor is quiet: the barrier has been processed, the child
 * has answered every ping, and exactly the sleeps its state implies (the
 * pending timer, the running task) are registered on the clock.
 */
const settle = (actor: ModelActor, clock: Recording) =>
  until(() => {
    const snapshot = actor.getSnapshot();
    const sleeping =
      Number(snapshot.matches({ timer: 'armed' })) +
      Number(snapshot.matches({ report: 'fetching' }));
    return (
      snapshot.context.syncs === syncs &&
      snapshot.context.counted === snapshot.context.sent &&
      clock.pending === sleeping
    );
  });
let syncs = 0;

const run = (actor: ModelActor, clock: Recording, command: Command) =>
  Effect.gen(function* () {
    if (command === 'TICK') {
      yield* TestClock.adjust('1 second');
    } else {
      actor.send({ type: command });
    }
    syncs++;
    actor.send({ type: 'SYNC' });
    yield* settle(actor, clock);
  });

const observe = (actor: ModelActor) => {
  const snapshot = actor.getSnapshot();
  return {
    value: snapshot.value,
    context: snapshot.context,
    child: snapshot.children.counter?.getSnapshot().context
  };
};

/**
 * Runs `commands`, persisting and restoring before index `k` when `k` is
 * given. Returns what an observer sees and what ran along the way.
 */
const execute = (commands: readonly Command[], k?: number) => {
  Object.assign(tally, { entries: 0, expired: 0, ready: 0, fetches: 0 });
  syncs = 0;
  const clock = recordingClock();
  let fetchingAtPersist = false;
  return Effect.gen(function* () {
    const first = commands.slice(0, k ?? commands.length);
    const persisted = yield* Effect.scoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(model);
        yield* settle(actor, clock.state);
        for (const command of first) {
          yield* run(actor, clock.state, command);
        }
        fetchingAtPersist = actor.getSnapshot().matches({ report: 'fetching' });
        return k === undefined
          ? observe(actor)
          : roundTrip(actor.getPersistedSnapshot());
      })
    );
    if (k === undefined) {
      return { observed: persisted, tally: { ...tally } };
    }
    const observed = yield* Effect.scoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(model, {
          snapshot: persisted as Snapshot<unknown>
        });
        yield* settle(actor, clock.state);
        for (const command of commands.slice(k)) {
          yield* run(actor, clock.state, command);
        }
        return observe(actor);
      })
    );
    return { observed, tally: { ...tally }, fetchingAtPersist };
  }).pipe(Effect.provide(clock.layer));
};

/** Checks a restored run against the same commands run uninterrupted. */
const expectSameAsUninterrupted = async (
  commands: readonly Command[],
  k: number
) => {
  const expected = await Effect.runPromise(execute(commands));
  const restored = await Effect.runPromise(execute(commands, k));
  expect(restored.observed).toEqual(expected.observed);
  // Entry actions never re-run and timers fire once.
  expect(restored.tally.entries).toBe(1);
  expect(restored.tally.expired).toBe(expected.tally.expired);
  expect(restored.tally.ready).toBe(expected.tally.ready);
  // Only a task that was running when persisted runs again.
  expect(restored.tally.fetches).toBe(
    expected.tally.fetches + Number(restored.fetchingAtPersist)
  );
};

describe('createEffectActor with a persisted snapshot', () => {
  it('resubscribes a restored root observable and receives values and completion', async () => {
    let subscriptions = 0;
    const logic = createObservableLogic<number, undefined>(() => ({
      subscribe(observer) {
        subscriptions++;
        if (typeof observer === 'function') {
          observer(subscriptions);
        } else {
          observer.next?.(subscriptions);
          if (subscriptions === 2) {
            observer.complete?.();
          }
        }
        return { unsubscribe() {} };
      }
    }));
    const snapshot = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* createEffectActor(logic);
          yield* waitFor(actor, (s) => s.context === 1);
          return roundTrip(actor.getPersistedSnapshot());
        })
      )
    );
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* createEffectActor(logic, { snapshot });
          yield* join(actor);
          expect(actor.getSnapshot().context).toBe(2);
          expect(actor.getSnapshot().status).toBe('done');
        })
      )
    );
    expect(subscriptions).toBe(2);
  });

  it('restores a nested machine timer on the Effect clock with its remaining delay', async () => {
    const child = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 1000: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const parent = createMachine({
      actors: { child },
      invoke: { src: 'child', id: 'child' }
    });
    const clock = recordingClock();
    await Effect.runPromise(
      Effect.gen(function* () {
        const snapshot = yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(parent);
            yield* until(() => clock.state.pending === 1);
            yield* TestClock.adjust('600 millis');
            return roundTrip(actor.getPersistedSnapshot());
          })
        );
        yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(parent, { snapshot });
            yield* until(() => clock.state.pending === 1);
            expect(clock.state.requested).toEqual([1000, 400]);
            expect(
              actor.getSnapshot().children.child?.getSnapshot().status
            ).toBe('active');
            yield* TestClock.adjust('400 millis');
            yield* until(
              () =>
                actor.getSnapshot().children.child?.getSnapshot().status ===
                'done'
            );
          })
        );
      }).pipe(Effect.provide(clock.layer))
    );
  });

  it('matches an uninterrupted run when restored at every step of every shortest path', async () => {
    const paths = getShortestPaths(model, {
      events: [
        { type: 'NEXT' },
        { type: 'BACK' },
        { type: 'FETCH' },
        { type: 'PING' }
      ],
      serializeState: (snapshot) =>
        JSON.stringify([snapshot.value, snapshot.context.sent])
    });
    expect(paths.length).toBeGreaterThan(10);
    for (const path of paths) {
      // The first step of every path is the actor's own initialization.
      const commands = path.steps
        .slice(1)
        .map((step) => step.event.type as Command);
      for (let k = 0; k <= commands.length; k++) {
        await expectSameAsUninterrupted(commands, k);
      }
    }
  });

  it('matches an uninterrupted run for generated events, clock advances and persist points', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom<Command>('NEXT', 'BACK', 'FETCH', 'PING', 'TICK'),
          {
            maxLength: 8
          }
        ),
        fc.nat(),
        async (commands, point) => {
          await expectSameAsUninterrupted(
            commands,
            point % (commands.length + 1)
          );
        }
      ),
      { seed: 5773, numRuns: 40 }
    );
  });

  it('resumes a pending delayed transition with its remaining delay', async () => {
    const machine = createMachine({
      initial: 'green',
      states: { green: { after: { 1000: { target: 'yellow' } } }, yellow: {} }
    });
    const clock = recordingClock();

    await Effect.runPromise(
      Effect.gen(function* () {
        const persisted = yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            yield* until(() => clock.state.pending === 1);
            yield* TestClock.adjust('600 millis');
            return roundTrip(actor.getPersistedSnapshot());
          })
        );
        yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine, {
              snapshot: persisted
            });
            yield* until(() => clock.state.pending === 1);
            expect(clock.state.requested).toEqual([1000, 400]);
            yield* TestClock.adjust('400 millis');
            yield* waitFor(actor, (s) => s.matches('yellow'));
          })
        );
      }).pipe(Effect.provide(clock.layer))
    );
  });

  it('fires a delayed transition whose deadline passed while persisted', async () => {
    const machine = createMachine({
      initial: 'green',
      states: { green: { after: { 1000: { target: 'yellow' } } }, yellow: {} }
    });
    const clock = recordingClock();

    await Effect.runPromise(
      Effect.gen(function* () {
        const persisted = yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            yield* until(() => clock.state.pending === 1);
            return roundTrip(actor.getPersistedSnapshot());
          })
        );
        // Nothing runs the timer while the snapshot is at rest.
        yield* TestClock.adjust('1 hour');
        yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine, {
              snapshot: persisted
            });
            yield* waitFor(actor, (s) => s.matches('yellow'));
          })
        );
      }).pipe(Effect.provide(clock.layer))
    );
  });

  it('stops a restored actor, its children and its timers when the scope closes', async () => {
    const clock = recordingClock();
    const persisted = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* createEffectActor(model);
          actor.send({ type: 'FETCH' });
          yield* until(() => clock.state.pending === 2);
          return roundTrip(actor.getPersistedSnapshot());
        })
      ).pipe(Effect.provide(clock.layer))
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        tally.expired = 0;
        const scope = yield* Scope.make();
        const actor = yield* Scope.provide(
          createEffectActor(model, { snapshot: persisted }),
          scope
        );
        yield* until(() => clock.state.pending === 2);
        yield* Scope.close(scope, Exit.void);

        expect(actor.getSnapshot().status).toBe('stopped');
        // The restarted task and the re-armed timer were interrupted.
        expect(clock.state.pending).toBe(0);
        yield* TestClock.adjust('1 hour');
        expect(tally.expired).toBe(0);
      }).pipe(Effect.provide(clock.layer))
    );
  });

  it('settles a restored final snapshot without running anything', async () => {
    let entered = 0;
    const machine = createMachine({
      initial: 'pending',
      states: {
        pending: { on: { FINISH: { target: 'done' } } },
        done: {
          type: 'final',
          entry: () => {
            entered++;
          }
        }
      },
      output: () => 'finished'
    });

    const output = await Effect.runPromise(
      Effect.gen(function* () {
        const persisted = yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            actor.send({ type: 'FINISH' });
            yield* join(actor);
            return roundTrip(actor.getPersistedSnapshot());
          })
        );
        return yield* Effect.scoped(
          Effect.flatMap(
            createEffectActor(machine, { snapshot: persisted }),
            join
          )
        );
      })
    );

    expect(output).toBe('finished');
    expect(entered).toBe(1);
  });

  describe('Effect tasks and streams that were running when persisted', () => {
    // A half-finished Effect is not serializable. Like XState's own restore
    // of an active async or callback actor, it starts again from the
    // beginning: its work runs at least once, possibly more than once.
    const persistWhile = (logic: AnyActorLogic, started: () => boolean) =>
      Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(logic);
            yield* until(started);
            return roundTrip(actor.getPersistedSnapshot());
          })
        )
      );

    it('restarts a root fromEffect task', async () => {
      let attempts = 0;
      const task = fromEffect(
        Effect.suspend(() =>
          ++attempts === 1 ? Effect.never : Effect.succeed('done')
        )
      );
      const snapshot = await persistWhile(task, () => attempts === 1);
      const output = await Effect.runPromise(
        Effect.scoped(
          Effect.flatMap(createEffectActor(task, { snapshot }), join)
        )
      );

      expect(output).toBe('done');
      expect(attempts).toBe(2);
    });

    it('restarts root and child streams from their first item', async () => {
      const seen: number[] = [];
      let runs = 0;
      const ticks = fromEffectStream(() => {
        const items = Stream.fromIterable([1, 2, 3]).pipe(
          Stream.tap((n) => Effect.sync(() => seen.push(n)))
        );
        // The first run stalls after two items, as if the host went away.
        return ++runs === 1
          ? Stream.concat(Stream.take(items, 2), Stream.never)
          : items;
      });
      const parent = setup({ actors: { ticks } }).createMachine({
        initial: 'listening',
        states: {
          listening: { invoke: { src: 'ticks', onDone: { target: 'done' } } },
          done: { type: 'final' }
        }
      });

      for (const logic of [ticks, parent] as const) {
        seen.length = 0;
        runs = 0;
        const snapshot = await persistWhile(logic, () => seen.length === 2);
        await Effect.runPromise(
          Effect.scoped(
            Effect.flatMap(
              createEffectActor(logic as typeof parent, { snapshot }),
              join
            )
          )
        );
        expect(runs).toBe(2);
        expect(seen).toEqual([1, 2, 1, 2, 3]);
      }
    });
  });

  it('restores without input when the logic requires input', () => {
    const machine = createMachine({
      schemas: { input: types<{ id: string }>() },
      context: ({ input }) => ({ id: input.id })
    });
    const snapshot = {} as Snapshot<unknown>;

    expectTypeOf(createEffectActor(machine, { snapshot })).not.toBeNever();
    expectTypeOf(
      createEffectActor(machine, { input: { id: 'a' } })
    ).not.toBeNever();
    // @ts-expect-error -- a fresh actor still needs its input
    createEffectActor(machine, {});
    // @ts-expect-error -- and so does one with no options at all
    createEffectActor(machine);
  });
});
