---
title: Persistence
description: Save and restore actor state.
---

Call `getPersistedSnapshot()` to get serializable actor state.

```ts
const persisted = actor.getPersistedSnapshot();
localStorage.setItem('checkout', JSON.stringify(persisted));
```

Restore the actor with the `snapshot` option.

```ts
const restored = createActor(machine, {
  snapshot: JSON.parse(localStorage.getItem('checkout')!)
}).start();
```

Persisted snapshots may include child actor state. Keep the actor logic compatible with snapshots already stored by your application.

Persistence is useful for a checkout resumed after a refresh and a backend order workflow resumed by a later request.

Store a machine version with each snapshot. Migrate or discard old snapshots when states, context or child actor logic change. Keep database clients, sockets and other live resources outside context.

Persisted snapshots record current state. Event sourcing records the events that produced it. Use event sourcing only when the event history itself is required.

## Persist children by address

By default a persisted snapshot embeds each child's persisted state, producing a whole-tree checkpoint. Pass `{ embedChildren: false }` to reference children by their logical address instead, leaving each child's state with the runtime that owns it.

```ts
const persisted = actor.getPersistedSnapshot({ embedChildren: false });
```

The option applies to the whole tree, not to a single placement boundary. Persisting by address requires each child to have a registered source key (a string `src`); `spawn(actors.worker)` and `enq.spawn(actors.worker)` retain that key, while inline actor logic cannot be referenced by address. Restoring an address-only child produces a location-transparent handle: sends to it route through the [system runtime](durable-execution.md), and its snapshot exposes lifecycle only, since a full snapshot is the last value an actor published and only co-located actors observe it. Install the system runtime before sending to a restored handle — without one, there is no route to the actor it references.

Persisted children changed shape in v6: each entry carries an `address` field and either an embedded `snapshot` or a `remote: true` marker. A remote entry may also carry an opaque `incarnation` token, round-tripped verbatim: XState never stamps one, but a host that does gets stale-completion protection on the referencing side and the token on journaled `sendTo` descriptors. Snapshots persisted by earlier versions restore unchanged; migrate them with [`machineVersions`](#migrations) if you validate their shape.

A timer persisted from a running actor carries its wall-clock start (`startedAt`), and restoring the snapshot schedules the remaining time toward the original deadline — a timer past due fires immediately. Snapshots produced by pure transitions carry no timestamp (they stay byte-deterministic across replays), so restoring one restarts each timer with its declared delay; durable hosts own timer scheduling through the [system runtime](durable-execution.md) instead.

An actor's address is the `/`-joined path of actor ids from the root, such as `order/worker:0`. It is stable across persistence and restore, unlike `sessionId`, which identifies one incarnation. Generated child ids are recorded in each snapshot's `_nextActorIds`, so restored actors keep numbering where they left off.

## Migrate machine versions

<!-- snapshot migration and event adaptation APIs from packages/core/src/machineVersions.ts -->

Register lightweight schema descriptors for historical versions and retain an
actual machine for each version that may be a target. Every entry must have the
same stable `id` and its own `version`.

Every lightweight entry satisfies `MachineVersionDescriptor`: `{ id, version }`
plus at least one of `snapshotSchema` or `eventSchema`. Versioned machines expose
both schemas themselves, so `machineVersions()` uses the same schema path for
machines and historical descriptors. It only checks whether an entry is
executable when resolving `to`.

```ts
const checkoutVersions = machineVersions([
  {
    id: 'checkout',
    version: '1',
    // This version had no persisted children, history, timers or state inputs.
    snapshotSchema: z.object({
      status: z.enum(['active', 'done', 'error', 'stopped']),
      output: z.unknown().optional(),
      error: z.unknown().optional(),
      value: z.literal('active'),
      context: z.object({ count: z.number() }),
      children: z.object({}),
      historyValue: z.object({}),
      timers: z.object({}),
      _nextActorIds: z.record(z.string(), z.number()).optional(),
      _nextTimerId: z.number(),
      stateInputs: z.undefined().optional(),
      machine: z.object({
        id: z.literal('checkout'),
        version: z.literal('1')
      }),
      version: z.literal('1')
    }),
    eventSchema: z.discriminatedUnion('type', [
      z.object({ type: z.literal('ADD'), value: z.number() }),
      z.object({ type: z.literal('REMOVE'), value: z.number() })
    ])
  },
  checkoutV2
]);
const snapshot = await checkoutVersions.migrateSnapshot(
  JSON.parse(localStorage.getItem('checkout')!),
  {
    to: '2',
    migrations: {
      '1': async (snapshot) => ({
        ...snapshot,
        context: { total: snapshot.context.count }
      })
    }
  }
);

const actor = createActor(checkoutV2, { snapshot }).start();
```

Exact version keys narrow the callback to that historical schema's output type.
Migration is direct to the target machine and may be asynchronous. You do not
need to retain old executable machines or define every intermediate version.

A `snapshotSchema` describes the entire persisted contract, not only context:
status/output/error, state value, context, children, history, timers, state
inputs, counters and version metadata as applicable. Active state nodes are
reconstructed from the state value, so `nodes` itself is not persisted. A
versioned machine's generated `snapshotSchema` validates this durable shape,
its state value and its configured context schema. It normalizes omitted
`historyValue` and `timers` to empty records, matching restoration behavior.

Use `'*'` to handle any snapshot that cannot use an exact retained version. The
snapshot is `unknown`, so the migration can inspect its shape or load an old
schema only when needed:

```ts
const checkoutVersions = machineVersions([checkoutV2]);
const snapshot = await checkoutVersions.migrateSnapshot(persisted, {
  to: '2',
  migrations: {
    '*': async (snapshot, source) => {
      const { checkoutV1Snapshot, migrateV1 } = await import(
        './checkout-v1-migration'
      );
      return migrateV1(await checkoutV1Snapshot.parseAsync(snapshot));
    }
  }
});
```

An exact version migration runs before `'*'`. If neither matches, migration
throws. Standard Schema validation may itself be asynchronous. There is no
separate lazy-loader API: use an async Standard Schema or the existing `'*'`
route when schema code must be imported conditionally. The target machine's
snapshot schema validates the stamped result, so a migration must produce a
valid `status`, a state value the target machine can resolve, and `children`.

The `to` version must be backed by an actual machine, because it interprets the
restored state. `machine.version` remains the compatibility stamp written to the
nested machine identity and legacy top-level `version` field.

When adopting versioning for snapshots that were already persisted without a
version, describe the old snapshot contract as an explicit version and configure
it as `unversioned`:

```ts
const checkoutVersions = machineVersions([checkoutV0, checkoutV1], {
  unversioned: '0'
});
```

This policy applies only when version metadata is absent. `parseSnapshot()`
still rejects an explicit unknown version; `migrateSnapshot()` may handle it
with `'*'`.

Use a runtime Standard Schema such as Zod to reject invalid persisted data.
`types<T>()` provides TypeScript inference only and does not validate at runtime.

## Adapt event histories

Event adaptation is separate from snapshot migration. Pass the source identity
once for the stream; events do not need version envelopes or metadata.

```ts
const events = await checkoutVersions.adaptEvents(storedEvents, {
  from: { id: 'checkout', version: '1' },
  to: '2',
  adapters: {
    '1': async (events) => [
      {
        type: 'totalChanged',
        amount: events.reduce(
          (total, event) => total + event.amount,
          0
        )
      }
    ]
  }
});
```

Adapters receive and return whole arrays, so they may insert, drop, combine or
reorder events. Exact retained-version adapters receive typed source events and
must return target events. `'*'` receives `unknown[]` plus the caller-provided
source identity, allowing lazy schema imports or shape-based adaptation.

An exact adapter takes precedence over `'*'`. A matching target version needs no
adapter. Source histories are validated before exact adapters when a source
event schema is available; unrecognized histories may fall through to `'*'`.
Every result, including a same-version history, is validated against available
target event schemas. If no applicable adapter exists, adaptation throws. An
exact adapter's error propagates instead of falling through to `'*'`.

An `eventSchema` validates each complete historical event object and infers the
exact adapter's event union. A descriptor may provide `snapshotSchema`,
`eventSchema` or both. If the relevant schema is absent, that operation may use
its unknown `'*'` handler instead. Actual machines continue to work directly as
entries. Their generated `eventSchema` turns the payload-oriented
`schemas.events` map into a Standard Schema for complete event objects.
Without that schema or a `'*'` adapter, adaptation reports the missing event
schema rather than treating the registered version as unknown.

Exact event and snapshot targets require actual machines. A schema descriptor
describes historical data but cannot interpret restored state or receive events.

`adaptEvents()` only adapts a materialized history. It does not store or replay
events and does not produce a snapshot.

## Persistence cheatsheet

```ts
const persisted = actor.getPersistedSnapshot();
const restored = createActor(logic, { snapshot: persisted }).start();
```
