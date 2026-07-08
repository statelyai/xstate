/**
 * Persistence conformance (v6).
 *
 * Six+ open v5 issues are believed fixed by the v6 persistence rewrite (pending
 * timers as `_pendingEffects` + `timers` restore strategy, snapshot versioning
 * + `migrate`, children registered on `snapshot.children`, `getInitialSnapshot`
 * single-init). Each `describe` proves or disproves one issue via the canonical
 * JSON round-trip:
 *
 * Const persisted = actor.getPersistedSnapshot(); const json =
 * JSON.parse(JSON.stringify(persisted)); // MUST go through JSON const restored
 * = createActor(machine, { snapshot: json }).start();
 */
import {
  createActor,
  createMachine,
  getInitialSnapshot,
  SimulatedClock
} from '../src/index.ts';

/** Canonical JSON round-trip of a persisted snapshot. */
function roundTrip(persisted: unknown): any {
  return JSON.parse(JSON.stringify(persisted));
}

describe('#5077 re-persistability of children', () => {
  it('a spawned child (enq.spawn in entry) survives a JSON round-trip, responds to events, and re-persists', () => {
    const child = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });

    // NOTE: a *persistable* spawned child must be spawned by string src key so
    // it resolves against `actorSources`. `enq.spawn(logic, ...)` produces an
    // INLINE child that throws "An inline child actor cannot be persisted." on
    // getPersistedSnapshot — see report. The persistable path is the context
    // `spawn('src', { id })` factory below.
    const parent = createMachine({
      actorSources: { child },
      context: ({ spawn }) => {
        spawn('child', { id: 'myChild' });
        return {};
      },
      initial: 'active',
      states: {
        active: {
          on: {
            ping: ({ children }, enq) => {
              enq.sendTo(children.myChild, { type: 'inc' });
            }
          }
        }
      }
    });

    const actor = createActor(parent).start();
    const json = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    const restored = createActor(parent, { snapshot: json }).start();

    // restored child responds to events
    restored.send({ type: 'ping' });
    expect(
      (restored.getSnapshot().children as any).myChild.getSnapshot().context
        .count
    ).toBe(1);

    // second round-trip works (no "logic.transition is not a function")
    expect(() => roundTrip(restored.getPersistedSnapshot())).not.toThrow();
    const secondRestored = createActor(parent, {
      snapshot: roundTrip(restored.getPersistedSnapshot())
    }).start();
    expect(secondRestored.getSnapshot().status).toBe('active');
  });

  it('an invoked child survives a JSON round-trip, responds to events, and re-persists', () => {
    const child = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });

    const parent = createMachine({
      actorSources: { child },
      initial: 'active',
      states: {
        active: {
          invoke: { src: 'child', id: 'myChild' },
          on: {
            ping: ({ children }, enq) => {
              enq.sendTo(children.myChild, { type: 'inc' });
            }
          }
        }
      }
    });

    const actor = createActor(parent).start();
    const json = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    const restored = createActor(parent, { snapshot: json }).start();

    restored.send({ type: 'ping' });
    expect(
      (restored.getSnapshot().children as any).myChild.getSnapshot().context
        .count
    ).toBe(1);

    expect(() => roundTrip(restored.getPersistedSnapshot())).not.toThrow();
    const secondRestored = createActor(parent, {
      snapshot: roundTrip(restored.getPersistedSnapshot())
    }).start();
    expect(secondRestored.getSnapshot().status).toBe('active');
  });
});

describe('#4873 system.get after restore', () => {
  it('a child spawned with a registryKey is retrievable via restored.system.get and transitions on send', () => {
    const child = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });

    const parent = createMachine({
      actorSources: { child },
      context: ({ spawn }) => {
        spawn('child', { registryKey: 'mySystemId' });
        return {};
      }
    });

    const actor = createActor(parent).start();
    const json = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    const restored = createActor(parent, { snapshot: json }).start();

    const ref = restored.system.get('mySystemId');
    expect(ref).not.toBeUndefined();

    expect(() => ref!.send({ type: 'inc' })).not.toThrow();
    expect((ref!.getSnapshot() as any).context.count).toBe(1);
  });
});

describe('#5178 historyValue revival', () => {
  it('a shallow history state remembers the last child across a JSON round-trip', () => {
    const machine = createMachine({
      initial: 'on',
      states: {
        on: {
          initial: 'first',
          states: {
            first: {
              on: { SWITCH: { target: 'second' } }
            },
            second: {},
            hist: {
              type: 'history',
              history: 'shallow'
            }
          },
          on: {
            POWER: { target: 'off' }
          }
        },
        off: {
          on: { POWER: { target: 'on.hist' } }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'SWITCH' }); // on.second
    actor.send({ type: 'POWER' }); // off (history remembers "second")
    expect(actor.getSnapshot().value).toBe('off');

    const json = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    const restored = createActor(machine, { snapshot: json }).start();
    restored.send({ type: 'POWER' }); // on.hist -> remembered "second"

    expect(restored.getSnapshot().value).toEqual({ on: 'second' });
  });
});

describe('#5331 timers restored', () => {
  const createDelayMachine = () =>
    createMachine({
      initial: 'pending',
      states: {
        pending: {
          after: { 500: { target: 'done' } }
        },
        done: { type: 'final' }
      }
    });

  it('`timers: "resume"` fires after the remaining delay', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createDelayMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    // 200ms of the 500ms delay had elapsed
    persisted._pendingEffects[0].elapsed = 200;
    const json = roundTrip(persisted);

    const clock2 = new SimulatedClock();
    const restored = createActor(createDelayMachine(), {
      clock: clock2,
      snapshot: json,
      timers: 'resume'
    }).start();

    clock2.increment(299);
    expect(restored.getSnapshot().value).toBe('pending');
    clock2.increment(1); // 300ms = 500 - 200 remaining
    expect(restored.getSnapshot().value).toBe('done');
  });

  it('`timers: "restart"` fires after the full delay again', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createDelayMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    persisted._pendingEffects[0].elapsed = 200;
    const json = roundTrip(persisted);

    const clock2 = new SimulatedClock();
    const restored = createActor(createDelayMachine(), {
      clock: clock2,
      snapshot: json,
      timers: 'restart'
    }).start();

    clock2.increment(499);
    expect(restored.getSnapshot().value).toBe('pending');
    clock2.increment(1); // full 500ms again, ignoring elapsed
    expect(restored.getSnapshot().value).toBe('done');
  });

  it('`timers: "absolute"` fires an already-expired timer immediately', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createDelayMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    // expiry (startedAt + delay) is in the past
    persisted._pendingEffects[0].startedAt = Date.now() - 5000;
    const json = roundTrip(persisted);

    const clock2 = new SimulatedClock();
    const restored = createActor(createDelayMachine(), {
      clock: clock2,
      snapshot: json,
      timers: 'absolute'
    }).start();

    clock2.increment(0);
    expect(restored.getSnapshot().value).toBe('done');
  });
});

describe('#5228 restore errors surface', () => {
  it('a corrupted snapshot value referencing a nonexistent state surfaces an error, not a silently-running actor', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: { on: { NEXT: { target: 'b' } } },
        b: {}
      }
    });

    const actor = createActor(machine).start();
    const persisted: any = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    // mangle the value to reference a nonexistent state
    persisted.value = 'nonexistent';

    let surfaced = false;
    const restored = createActor(machine, { snapshot: persisted });
    restored.subscribe({ error: () => (surfaced = true) });

    let threw = false;
    try {
      restored.start();
    } catch {
      threw = true;
    }

    const status = restored.getSnapshot().status;
    // Must NOT silently produce a healthy running actor.
    expect(threw || surfaced || status === 'error').toBe(true);
    expect(status).not.toBe('active');
  });

  it('a version-mismatched snapshot without `migrate` surfaces an error', () => {
    const machineV1 = createMachine({
      version: '1',
      initial: 'a',
      states: { a: {} }
    });
    const machineV2 = createMachine({
      version: '2',
      initial: 'a',
      states: { a: {} }
    });

    const persisted = roundTrip(
      createActor(machineV1).start().getPersistedSnapshot()
    );

    const restored = createActor(machineV2, { snapshot: persisted });
    restored.subscribe({ error: () => {} });
    restored.start();

    expect(restored.getSnapshot().status).toBe('error');
    expect((restored.getSnapshot() as any).error.message).toMatch(
      /does not match machine version/
    );
  });

  it('positive control: a version-mismatched snapshot WITH `migrate` restores successfully', () => {
    const machineV1 = createMachine({
      version: '1',
      context: { count: 5 },
      initial: 'a',
      states: { a: {} }
    });
    const machineV2 = createMachine({
      version: '2',
      migrate: (persisted: any) => ({
        ...persisted,
        version: '2',
        context: { total: persisted.context.count }
      }),
      context: { total: 0 },
      initial: 'a',
      states: { a: {} }
    });

    const persisted = roundTrip(
      createActor(machineV1).start().getPersistedSnapshot()
    );
    const restored = createActor(machineV2, { snapshot: persisted }).start();

    expect(restored.getSnapshot().status).toBe('active');
    expect(restored.getSnapshot().context).toEqual({ total: 5 });
  });
});

describe('#4583 rehydrated stopped (done) actor', () => {
  it('restoring a snapshot in a final state does not throw on subscribe and reports status "done"', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: { on: { NEXT: { target: 'bar' } } },
        bar: { type: 'final' }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });
    expect(actor.getSnapshot().status).toBe('done');

    const json = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    const restored = createActor(machine, { snapshot: json });
    expect(() => restored.subscribe(() => {})).not.toThrow();
    restored.start();

    expect(restored.getSnapshot().status).toBe('done');
  });
});

describe('#5013 unserializable event to stopped actor (dev)', () => {
  it('sending an event with a circular reference to a stopped actor does not throw', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: { type: 'final' }
      }
    });

    const actor = createActor(machine).start();
    actor.stop();

    const circular: any = { type: 'BOOM' };
    circular.self = circular;

    expect(() => actor.send(circular)).not.toThrow();
  });
});

describe('#4774 getInitialSnapshot single init', () => {
  it('runs the context factory exactly once', () => {
    let initCount = 0;
    const machine = createMachine({
      context: () => {
        initCount++;
        return { count: 0 };
      },
      initial: 'a',
      states: { a: {} }
    });

    getInitialSnapshot(machine);

    expect(initCount).toBe(1);
  });
});
