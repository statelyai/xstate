---
'xstate': minor
---

Add typed helpers for migrating persisted snapshots between retained machine versions.

```ts
const versions = machineVersions([checkoutV1, checkoutV2]);
const source = await versions.parseSnapshot(persisted);
const snapshot = await migrateSnapshot(source, checkoutV2, {
  '1': (snapshot) => ({
    ...snapshot,
    context: { total: snapshot.context.count }
  })
});

createActor(checkoutV2, { snapshot }).start();
```

Existing unversioned snapshots can be assigned to an explicitly retained version
before migration:

```ts
const versions = machineVersions([checkoutV0, checkoutV1], {
  unversioned: '0'
});
```
