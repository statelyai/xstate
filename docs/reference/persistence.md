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

## Migrate machine versions

<!-- machine version parsing and migration APIs from packages/core/src/machineVersions.ts -->

Register the machine versions whose persisted data you want parsed and typed.
Each machine must have the same stable `id` and its own `version`.

```ts
const checkoutVersions = machineVersions([checkoutV1, checkoutV2]);
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

Exact version keys narrow the callback to that retained machine's snapshot type.
Migration is direct to the target machine and may be asynchronous. You do not
need to define every intermediate version.

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
throws. The target context schema validates the result before its machine
identity and version are stamped.

When adopting versioning for snapshots that were already persisted without a
version, retain the old machine definition as an explicit version and configure it
as `unversioned`:

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

## Persistence cheatsheet

```ts
const persisted = actor.getPersistedSnapshot();
const restored = createActor(logic, { snapshot: persisted }).start();
```
