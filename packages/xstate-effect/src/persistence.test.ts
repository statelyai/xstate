import { Effect, Exit, Scope, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import { createMachine, setup, types, type Snapshot } from 'xstate';
import {
  createEffectActor,
  fromEffect,
  type EffectActor,
  fromEffectStream,
  waitFor
} from './index.ts';

/** Persists like a host would: through JSON, into a different process. */
const roundTrip = (snapshot: Snapshot<unknown>): Snapshot<unknown> =>
  JSON.parse(JSON.stringify(snapshot));

/**
 * Polls until `predicate` holds. Effects run on detached fibers, so tests wait
 * for the condition they assert on instead of for a fixed number of ticks.
 */
const until = async (predicate: () => boolean, timeoutMs = 1000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

/**
 * Lets an actor's loop register its timers before a test advances the
 * `TestClock` or persists the actor.
 */
const flush = Effect.promise(
  () => new Promise<void>((resolve) => setTimeout(resolve, 5))
);

type Letter = 'X' | 'Y' | 'Z';

/**
 * Three states and three non-commuting context updates, so any lost,
 * repeated or reordered event changes the result.
 */
const step = (target: 'a' | 'b' | 'c', update: (count: number) => number) => ({
  target,
  context: ({
    context,
    event
  }: {
    context: { count: number; trail: string };
    event: { type: string };
  }) => ({
    count: update(context.count),
    trail: context.trail + event.type
  })
});

let entries = 0;
const counter = createMachine({
  id: 'counter',
  schemas: {
    events: { X: types<{}>(), Y: types<{}>(), Z: types<{}>() }
  },
  context: { count: 1, trail: '' },
  entry: () => {
    entries++;
  },
  initial: 'a',
  states: {
    a: {
      on: {
        X: step('b', (n) => n + 1),
        Y: step('a', (n) => n * 2),
        Z: step('c', (n) => n - 1)
      }
    },
    b: {
      on: {
        X: step('c', (n) => n * 2),
        Y: step('a', (n) => n + 3),
        Z: step('b', (n) => n + 1)
      }
    },
    c: {
      on: {
        X: step('a', (n) => n - 2),
        Y: step('b', (n) => n + 1),
        Z: step('c', (n) => n * 3)
      }
    }
  }
});

/** Sends `events` and returns the snapshot after the last one is processed. */
const drive = (actor: EffectActor<typeof counter>, events: readonly Letter[]) =>
  Effect.gen(function* () {
    const target = actor.getSnapshot().context.trail.length + events.length;
    for (const type of events) {
      actor.send({ type });
    }
    return yield* waitFor(
      actor,
      (snapshot) => snapshot.context.trail.length === target
    );
  });

const observable = (snapshot: {
  value: unknown;
  context: unknown;
  status: string;
}) => ({
  value: snapshot.value,
  context: snapshot.context,
  status: snapshot.status
});

/** Runs `events` in one actor. */
const continuous = (events: readonly Letter[]) =>
  Effect.scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(counter);
      return observable(yield* drive(actor, events));
    })
  );

/** Runs `events` with a persist and restore between index `k - 1` and `k`. */
const interrupted = (events: readonly Letter[], k: number) =>
  Effect.gen(function* () {
    const persisted = yield* Effect.scoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counter);
        yield* drive(actor, events.slice(0, k));
        return roundTrip(actor.getPersistedSnapshot());
      })
    );
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counter, {
          snapshot: persisted
        });
        return observable(yield* drive(actor, events.slice(k)));
      })
    );
  });

/** Every sequence over `X`, `Y` and `Z` with at most `maxLength` events. */
const sequences = (maxLength: number): Letter[][] => {
  const result: Letter[][] = [[]];
  let previous: Letter[][] = [[]];
  for (let length = 1; length <= maxLength; length++) {
    previous = previous.flatMap((sequence) =>
      (['X', 'Y', 'Z'] as const).map((letter) => [...sequence, letter])
    );
    result.push(...previous);
  }
  return result;
};

describe('createEffectActor with a persisted snapshot', () => {
  it('resumes where the persisted actor left off', async () => {
    entries = 0;
    const expected = await Effect.runPromise(continuous(['X', 'Z', 'Y']));
    entries = 0;
    const restored = await Effect.runPromise(interrupted(['X', 'Z', 'Y'], 2));

    expect(restored).toEqual(expected);
    expect(restored).toEqual({
      value: 'a',
      context: { count: 6, trail: 'XZY' },
      status: 'active'
    });
    // Restoring does not re-run entry actions.
    expect(entries).toBe(1);
  });

  it('matches one continuous run when restored at any point of any event sequence', async () => {
    // Exhaustive over every sequence of up to four events (121 sequences),
    // split at every index (547 restores).
    for (const events of sequences(4)) {
      const expected = await Effect.runPromise(continuous(events));
      for (let k = 0; k <= events.length; k++) {
        const restored = await Effect.runPromise(interrupted(events, k));
        expect({ events, k, ...restored }).toEqual({
          events,
          k,
          ...expected
        });
      }
    }
  });

  it('resumes a pending delayed transition with its remaining delay', async () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: { after: { 1000: { target: 'yellow' } } },
        yellow: {}
      }
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const persisted = yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            yield* TestClock.adjust('600 millis');
            return roundTrip(actor.getPersistedSnapshot());
          })
        );

        yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine, {
              snapshot: persisted
            });
            yield* flush;
            yield* TestClock.adjust('399 millis');
            yield* flush;
            expect(actor.getSnapshot().value).toBe('green');

            yield* TestClock.adjust('1 millis');
            const snapshot = yield* waitFor(actor, (s) => s.matches('yellow'));
            expect(snapshot.value).toBe('yellow');
          })
        );
      }).pipe(Effect.provide(TestClock.layer()))
    );
  });

  it('fires a delayed transition whose deadline passed while persisted', async () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: { after: { 1000: { target: 'yellow' } } },
        yellow: {}
      }
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const persisted = yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            // Accepting the timer records its start in the snapshot.
            yield* flush;
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
            yield* flush;
            yield* TestClock.adjust('0 millis');
            const snapshot = yield* waitFor(actor, (s) => s.matches('yellow'));
            expect(snapshot.value).toBe('yellow');
          })
        );
      }).pipe(Effect.provide(TestClock.layer()))
    );
  });

  it('stops a restored actor, its children and its timers when the scope closes', async () => {
    let started = 0;
    let interrupted = 0;
    let fired = 0;
    const work = fromEffect(
      Effect.gen(function* () {
        started++;
        return yield* Effect.never;
      }).pipe(
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            interrupted++;
          })
        )
      )
    );
    const machine = setup({ actors: { work } }).createMachine({
      initial: 'working',
      states: {
        working: {
          invoke: { src: 'work' },
          after: { 1000: { target: 'late' } }
        },
        late: {
          entry: () => {
            fired++;
          }
        }
      }
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const persisted = yield* Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            yield* Effect.promise(() => until(() => started === 1));
            return roundTrip(actor.getPersistedSnapshot());
          })
        );
        expect(interrupted).toBe(1);

        const scope = yield* Scope.make();
        const actor = yield* Scope.provide(
          createEffectActor(machine, { snapshot: persisted }),
          scope
        );
        yield* Effect.promise(() => until(() => started === 2));
        expect(actor.getSnapshot().status).toBe('active');

        yield* Scope.close(scope, Exit.void);

        expect(actor.getSnapshot().status).toBe('stopped');
        expect(interrupted).toBe(2);
        yield* TestClock.adjust('1 hour');
        expect(fired).toBe(0);
      }).pipe(Effect.provide(TestClock.layer()))
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

    const persisted = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* createEffectActor(machine);
          actor.send({ type: 'FINISH' });
          yield* waitFor(actor, (s) => s.status === 'done').pipe(
            Effect.catch(() => Effect.void)
          );
          return roundTrip(actor.getPersistedSnapshot());
        })
      )
    );

    const snapshot = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* createEffectActor(machine, {
            snapshot: persisted
          });
          yield* Effect.promise(() =>
            until(() => actor.getSnapshot().status === 'done')
          );
          return actor.getSnapshot();
        })
      )
    );

    expect(snapshot.status).toBe('done');
    expect(snapshot.output).toBe('finished');
    expect(entered).toBe(1);
  });

  describe('children that were running when the snapshot was taken', () => {
    // A half-finished Effect is not serializable. Like XState's own restore
    // of an active async or callback actor, the child starts again from the
    // beginning: its work runs at least once, possibly more than once.
    it('restarts a running fromEffect child from the beginning', async () => {
      let attempts = 0;
      const lookup = fromEffect(({ input }: { input: { id: string } }) =>
        Effect.gen(function* () {
          attempts++;
          if (attempts === 1) {
            return yield* Effect.never;
          }
          return `user ${input.id}`;
        })
      );
      const machine = setup({ actors: { lookup } }).createMachine({
        context: { user: '' },
        initial: 'loading',
        states: {
          loading: {
            invoke: {
              src: 'lookup',
              input: () => ({ id: '42' }),
              onDone: {
                target: 'ready',
                context: ({ event }) => ({ user: event.output })
              }
            }
          },
          ready: {}
        }
      });

      const persisted = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            yield* Effect.promise(() => until(() => attempts === 1));
            return roundTrip(actor.getPersistedSnapshot());
          })
        )
      );

      const snapshot = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine, {
              snapshot: persisted
            });
            return yield* waitFor(actor, (s) => s.matches('ready'));
          })
        )
      );

      expect(attempts).toBe(2);
      expect(snapshot.context.user).toBe('user 42');
    });

    it('restarts a running fromEffectStream child from its first item', async () => {
      const seen: number[] = [];
      let runs = 0;
      const ticks = fromEffectStream(() => {
        runs++;
        const items = Stream.fromIterable([1, 2, 3]).pipe(
          Stream.tap((n) => Effect.sync(() => seen.push(n)))
        );
        // The first run stalls after two items, as if the host went away.
        return runs === 1
          ? Stream.concat(Stream.take(items, 2), Stream.never)
          : items;
      });
      const machine = setup({ actors: { ticks } }).createMachine({
        initial: 'listening',
        states: {
          listening: {
            invoke: { src: 'ticks', onDone: { target: 'finished' } }
          },
          finished: {}
        }
      });

      const persisted = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            yield* Effect.promise(() => until(() => seen.length === 2));
            return roundTrip(actor.getPersistedSnapshot());
          })
        )
      );

      await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine, {
              snapshot: persisted
            });
            yield* waitFor(actor, (s) => s.matches('finished'));
          })
        )
      );

      expect(runs).toBe(2);
      expect(seen).toEqual([1, 2, 1, 2, 3]);
    });
  });
});
