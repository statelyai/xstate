---
'xstate': minor
---

Represent historical machine versions with Standard Schema snapshot and event
descriptors instead of retaining their executable machines.

```ts
const versions = machineVersions([
  {
    id: 'checkout',
    version: '1',
    snapshotSchema: checkoutV1Snapshot,
    eventSchema: checkoutV1Event
  },
  checkoutV2
]);

const snapshot = await versions.migrateSnapshot(persisted, {
  to: '2',
  migrations: {
    '1': (snapshot) => ({
      ...snapshot,
      context: { total: snapshot.context.count }
    })
  }
});
```
