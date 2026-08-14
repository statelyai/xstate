---
'xstate': minor
---

Represent historical persisted machine versions with complete Standard Schema snapshot descriptors instead of retaining their executable machines.

```ts
const versions = machineVersions([
  snapshotVersion({ id: 'checkout', version: '1', schema: checkoutV1Snapshot }),
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
