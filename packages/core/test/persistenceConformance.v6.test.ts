/**
 * Persistence conformance (v6).
 *
 * Six+ open v5 issues are believed fixed by the v6 persistence rewrite: logical
 * snapshot timers, snapshot versioning + `migrate`, children registered on
 * `snapshot.children`, and `getInitialSnapshot` single-init. Each `describe`
 * proves or disproves one issue via the canonical JSON round-trip:
 *
 * Const persisted = actor.getPersistedSnapshot(); const json =
 * JSON.parse(JSON.stringify(persisted)); // MUST go through JSON const restored
 * = createActor(machine, { snapshot: json }).start();
 */
import {
  createActor,
  createMachine,
  getInitialSnapshot,
  PERSISTED_SNAPSHOT_FORMAT_VERSION,
  PersistedSnapshotFormatError,
  upgradePersistedSnapshot,
  setup,
  SimulatedClock
} from '../src/index.ts';
import { StateMachine } from '../src/StateMachine.ts';
import Ajv2020 from 'ajv/dist/2020';
import persistedSnapshotSchema from '../src/persistedSnapshot.schema.json';

/** Canonical JSON round-trip of a persisted snapshot. */
function roundTrip(persisted: unknown): any {
  return JSON.parse(JSON.stringify(persisted));
}

/**
 * Every machine envelope produced in this file — root and nested machine
 * children, which persist through the same method — is validated against
 * `src/persistedSnapshot.schema.json` after a JSON round-trip.
 */
const validateEnvelope = new Ajv2020({ allErrors: true }).compile(
  persistedSnapshotSchema
);
const envelopeErrors: unknown[] = [];
let validatedEnvelopes = 0;
const originalGetPersistedSnapshot =
  StateMachine.prototype.getPersistedSnapshot;
beforeAll(() => {
  vi.spyOn(StateMachine.prototype, 'getPersistedSnapshot').mockImplementation(
    function (
      this: StateMachine<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
      >,
      ...args
    ) {
      const persisted = originalGetPersistedSnapshot.apply(this, args);
      let json: unknown;
      try {
        json = roundTrip(persisted);
      } catch {
        // Non-JSON payloads are the host's problem (see the dev warning).
        return persisted;
      }
      validatedEnvelopes++;
      if (!validateEnvelope(json)) {
        envelopeErrors.push(validateEnvelope.errors);
      }
      return persisted;
    }
  );
});
afterEach(() => {
  expect(envelopeErrors.splice(0)).toEqual([]);
});
afterAll(() => {
  vi.restoreAllMocks();
  expect(validatedEnvelopes).toBeGreaterThan(0);
});

describe('persisted snapshot format version', () => {
  const machine = createMachine({
    id: 'fmt',
    initial: 'a',
    states: { a: {} }
  });

  it('stamps formatVersion 1 on root and nested machine envelopes', () => {
    const parent = createMachine({
      id: 'parent',
      actors: { child: machine },
      invoke: { id: 'child', src: 'child' }
    });
    const persisted = roundTrip(createActor(parent).getPersistedSnapshot());
    expect(PERSISTED_SNAPSHOT_FORMAT_VERSION).toBe(1);
    expect(persisted.formatVersion).toBe(1);
    expect(persisted.children.child.snapshot.formatVersion).toBe(1);
  });

  it('rejects a snapshot without formatVersion', () => {
    const { formatVersion: _, ...legacy } = roundTrip(
      createActor(machine).getPersistedSnapshot()
    );
    expect(() => machine.restoreSnapshot(legacy)).toThrow(
      PersistedSnapshotFormatError
    );
    expect(() => upgradePersistedSnapshot(legacy)).toThrow(
      /predates the XState v6 beta snapshot format/
    );

    const actor = createActor(machine, { snapshot: legacy });
    actor.subscribe({ error: () => {} });
    expect(actor.getSnapshot().status).toBe('error');
    expect(actor.getSnapshot().error).toBeInstanceOf(
      PersistedSnapshotFormatError
    );
  });

  it('rejects a snapshot with a newer formatVersion', () => {
    const newer = {
      ...roundTrip(createActor(machine).getPersistedSnapshot()),
      formatVersion: 2
    };
    expect(() => machine.restoreSnapshot(newer)).toThrow(
      /newer than this XState version supports/
    );
  });

  it('upgradePersistedSnapshot returns a v1 snapshot unchanged', () => {
    const persisted = roundTrip(createActor(machine).getPersistedSnapshot());
    expect(upgradePersistedSnapshot(persisted)).toBe(persisted);
  });

  it('does not require formatVersion on a live snapshot', () => {
    const live = createActor(machine).getSnapshot();
    expect(() => machine.restoreSnapshot(live)).not.toThrow();
  });
});

describe('non-JSON payload warning (dev)', () => {
  it.each([
    ['function', { fn: () => {} }, 'context.fn'],
    ['symbol', { list: [Symbol('s')] }, 'context.list[0]'],
    ['bigint', { n: 1n }, 'context.n'],
    ['Map', { m: new Map() }, 'context.m'],
    ['Set', { nested: { s: new Set() } }, 'context.nested.s']
  ])('warns once for a %s', (kind, context, path) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const machine = createMachine({ context: context as any });
    createActor(machine).getPersistedSnapshot();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(`(${kind}) at '${path}'`);
    warn.mockRestore();
  });

  it('warns for a circular reference', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const machine = createMachine({ context: { circular } });
    // persistContext itself does not guard against cycles; the warning is
    // emitted first so the offending path is visible.
    expect(() => createActor(machine).getPersistedSnapshot()).toThrow(
      RangeError
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      "(circular reference) at 'context.circular.self'"
    );
    warn.mockRestore();
  });

  it('does not warn for JSON values, Dates, shared references, or actor refs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const shared = { a: 1 };
    const machine = createMachine({
      context: ({ spawn }) => ({
        date: new Date(0),
        left: shared,
        right: shared,
        ref: spawn(createMachine({}))
      })
    });
    createActor(machine).getPersistedSnapshot({
      __unsafeAllowInlineActors: true
    } as any);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('#5077 re-persistability of children', () => {
  it('a transition-spawned registered child survives a JSON round-trip and re-persists', () => {
    const child = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });
    const parent = createMachine({
      actors: { child },
      on: {
        spawn: (_, enq) => {
          enq.spawn('child', { id: 'myChild' });
        },
        ping: ({ children }, enq) => {
          enq.sendTo(children.myChild, { type: 'inc' });
        }
      }
    });

    const actor = createActor(parent).start();
    actor.send({ type: 'spawn' });
    const persisted = roundTrip(actor.getPersistedSnapshot());
    expect(persisted.children.myChild.src).toBe('child');
    actor.stop();

    const restored = createActor(parent, { snapshot: persisted }).start();
    restored.send({ type: 'ping' });
    expect(
      (restored.getSnapshot().children as any).myChild.getSnapshot().context
        .count
    ).toBe(1);
    expect(
      roundTrip(restored.getPersistedSnapshot()).children.myChild.src
    ).toBe('child');
  });

  it('a provided actor retains its registered source when transition-spawned', () => {
    const child = createMachine({});
    const parent = createMachine({
      actors: {} as { child: typeof child },
      on: {
        spawn: (_, enq) => {
          enq.spawn('child', { id: 'myChild' });
        }
      }
    }).provide({ actors: { child } });

    const actor = createActor(parent).start();
    actor.send({ type: 'spawn' });

    expect(roundTrip(actor.getPersistedSnapshot()).children.myChild.src).toBe(
      'child'
    );
  });

  it('an extended actor retains its registered source when transition-spawned', () => {
    const child = createMachine({});
    const parent = setup()
      .extend({ actors: { child } })
      .createMachine({
        on: {
          spawn: (_, enq) => {
            enq.spawn('child', { id: 'myChild' });
          }
        }
      });

    const actor = createActor(parent).start();
    actor.send({ type: 'spawn' });

    expect(roundTrip(actor.getPersistedSnapshot()).children.myChild.src).toBe(
      'child'
    );
  });

  it('preserves the explicitly selected source when duplicate registrations later diverge', () => {
    const shared = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });
    const replacement = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context }) => ({ context: { count: context.count + 10 } })
      }
    });
    const parent = createMachine({
      actors: { first: shared, second: shared },
      on: {
        spawn: (_, enq) => {
          enq.spawn('second', { id: 'worker' });
        },
        ping: ({ children }, enq) => {
          enq.sendTo(children.worker, { type: 'inc' });
        }
      }
    });

    const actor = createActor(parent).start();
    actor.send({ type: 'spawn' });
    const persisted = roundTrip(actor.getPersistedSnapshot());
    expect(persisted.children.worker.src).toBe('second');
    actor.stop();

    const migratedParent = parent.provide({ actors: { second: replacement } });
    const restored = createActor(migratedParent, {
      snapshot: persisted
    }).start();
    restored.send({ type: 'ping' });
    expect(
      (restored.getSnapshot().children as any).worker.getSnapshot().context
        .count
    ).toBe(10);
  });

  it('throws immediately when a declared actor source has no implementation', () => {
    const child = createMachine({});
    const parent = createMachine({
      actors: {} as { child: typeof child },
      entry: (_, enq) => {
        enq.spawn('child');
      }
    });

    expect(() => getInitialSnapshot(parent)).toThrow(
      "Actor source 'child' is not provided"
    );
  });

  it('a spawned child survives a JSON round-trip, responds to events, and re-persists', () => {
    const child = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });

    const parent = createMachine({
      actors: { child },
      context: ({ spawn, actors }) => {
        spawn(actors.child, { id: 'myChild' });
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

  it('an invoked child survives a JSON round-trip, responds to events, and re-persists', () => {
    const child = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });

    const parent = createMachine({
      actors: { child },
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

  it('assigns a new runtime session to a restored child', () => {
    const child = createMachine({});
    const parent = createMachine({
      actors: { child },
      context: ({ spawn, actors }) => {
        spawn(actors.child, { id: 'myChild' });
        return {};
      }
    });
    const actor = createActor(parent).start();
    const sessionId = actor.getSnapshot().children.myChild.sessionId;
    const persisted = roundTrip(actor.getPersistedSnapshot());
    expect(persisted.children.myChild).not.toHaveProperty('incarnationId');
    expect(persisted.children.myChild).not.toHaveProperty('sessionId');
    actor.stop();

    const restored = createActor(parent, { snapshot: persisted }).start();
    const restoredChild = restored.getSnapshot().children.myChild;

    expect(restoredChild.sessionId).not.toBe(sessionId);

    restored.send({
      type: 'xstate.done.actor.myChild',
      actorId: 'myChild',
      sessionId,
      output: undefined
    } as any);

    expect(restored.getSnapshot().children.myChild).toBe(restoredChild);
  });

  it('does not reuse a removed child incarnation after restoration', () => {
    const child = createMachine({});
    const parent = createMachine({
      actors: { child },
      entry: (_, enq) => enq.spawn(child, { id: 'myChild' }),
      on: {
        REMOVE: ({ children }, enq) => enq.stop(children.myChild),
        SPAWN: (_, enq) => {
          enq.spawn(child, { id: 'myChild' });
        }
      }
    });
    const actor = createActor(parent).start();
    const removedSessionId = actor.getSnapshot().children.myChild.sessionId;
    actor.send({ type: 'REMOVE' });
    const persisted = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    const restored = createActor(parent, { snapshot: persisted }).start();
    restored.send({ type: 'SPAWN' });
    const replacement = restored.getSnapshot().children.myChild;

    expect(replacement.sessionId).not.toBe(removedSessionId);

    restored.send({
      type: 'xstate.done.actor.myChild',
      actorId: 'myChild',
      sessionId: removedSessionId,
      output: undefined
    } as any);

    expect(restored.getSnapshot().children.myChild).toBe(replacement);
  });
});

describe('missing persisted child sources', () => {
  it('fails restoration instead of silently dropping the child', () => {
    const child = createMachine({});
    const parent = createMachine({
      actors: {} as { child: typeof child },
      context: ({ spawn, actors }) => {
        spawn(actors.child, { id: 'myChild' });
        return {};
      }
    });
    const configuredParent = parent.provide({
      actors: { child }
    });
    const actor = createActor(configuredParent).start();
    const persisted = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    const restored = createActor(parent, { snapshot: persisted });

    expect(restored.getSnapshot()).toMatchObject({
      status: 'error',
      error: expect.objectContaining({
        message: expect.stringContaining("child source 'child'")
      })
    });
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
      actors: { child },
      context: ({ spawn, actors }) => {
        spawn(actors.child, { registryKey: 'mySystemId' });
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
              history: 'shallow',
              target: 'first'
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

describe('#5331 logical timers restored', () => {
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

  it('persists timer intent and restarts its declared delay locally', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createDelayMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    const json = roundTrip(persisted);
    const [timer] = Object.values(json.timers) as any[];
    expect(timer).toMatchObject({
      delay: 500,
      target: 'self',
      event: { type: expect.stringMatching(/^xstate\.after/) }
    });
    // Only the wall clock stamps `startedAt`; this actor runs under a
    // simulated clock, whose readings are meaningless in another process.
    expect(timer).not.toHaveProperty('startedAt');
    expect(timer).not.toHaveProperty('elapsed');

    const clock2 = new SimulatedClock();
    const restored = createActor(createDelayMachine(), {
      clock: clock2,
      snapshot: json
    }).start();

    clock2.increment(499);
    expect(restored.getSnapshot().value).toBe('pending');
    clock2.increment(1); // full 500ms again, ignoring elapsed
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

  it('preserves an explicit child source through parent snapshot migration', () => {
    const shared = createMachine({ context: { implementation: 'shared' } });
    const secondV2 = createMachine({
      context: { implementation: 'second-v2' }
    });
    const machineV1 = createMachine({
      version: '1',
      actors: { first: shared, second: shared },
      entry: (_, enq) => {
        enq.spawn('second', { id: 'worker' });
      }
    });
    const machineV2 = createMachine({
      version: '2',
      migrate: (persisted: any) => ({ ...persisted, version: '2' }),
      actors: { first: shared, second: secondV2 }
    });

    const persisted = roundTrip(
      createActor(machineV1).start().getPersistedSnapshot()
    );
    expect(persisted.children.worker.src).toBe('second');

    const restored = createActor(machineV2, { snapshot: persisted }).start();
    expect((restored.getSnapshot().children as any).worker.logic).toBe(
      secondV2
    );
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
