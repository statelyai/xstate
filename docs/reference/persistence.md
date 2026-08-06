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

Keep the old machines whose persisted data you still support. `machineVersions()`
uses their schemas to parse persisted snapshots. Each machine must have the same
stable `id` and its own `version`.

```ts
const checkoutVersions = machineVersions([checkoutV1, checkoutV2]);
const source = await checkoutVersions.parseSnapshot(
  JSON.parse(localStorage.getItem('checkout')!)
);

const snapshot = await migrateSnapshot(source, checkoutV2, {
  '1': (snapshot) => ({
    ...snapshot,
    context: { total: snapshot.context.count }
  })
});

const actor = createActor(checkoutV2, { snapshot }).start();
```

The source version narrows the migration callback to that machine's context type.
Migration is direct to the target machine. You do not need to define every
intermediate version.

When adopting versioning for snapshots that were already persisted without a
version, retain the old machine definition as an explicit version and configure it
as `unversioned`:

```ts
const checkoutVersions = machineVersions([checkoutV0, checkoutV1], {
  unversioned: '0'
});
```

This policy applies only when version metadata is absent. An explicit unknown
version is still rejected.

Use a runtime Standard Schema such as Zod to reject invalid persisted data.
`types<T>()` provides TypeScript inference only and does not validate at runtime.

## Persistence cheatsheet

```ts
const persisted = actor.getPersistedSnapshot();
const restored = createActor(logic, { snapshot: persisted }).start();
```
