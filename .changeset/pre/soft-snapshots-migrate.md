---
'xstate': minor
---

Migrate persisted snapshots directly from `unknown` values with
`machineVersions().migrateSnapshot()`. Exact version handlers are typed from
retained machines, while `'*'` handles unversioned, unrecognized, or
shape-detected snapshots. All migration handlers may be asynchronous.

```ts
const versions = machineVersions([checkoutV1, checkoutV2]);
const snapshot = await versions.migrateSnapshot(persisted, {
  to: '2',
  migrations: {
    '1': async (snapshot) => migrateV1(snapshot),
    '*': async (snapshot, source) => migrateUnknown(snapshot, source)
  }
});
```
