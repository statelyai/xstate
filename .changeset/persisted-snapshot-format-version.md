---
'xstate': minor
---

Persisted machine snapshots now carry a library-owned `formatVersion: 1`, separate from your machine's `version`. Restoring a snapshot without `formatVersion` (persisted before the v6 beta) or with a newer one throws `PersistedSnapshotFormatError`. `PERSISTED_SNAPSHOT_FORMAT_VERSION` and `upgradePersistedSnapshot()` are also exported; `upgradePersistedSnapshot()` validates a stored snapshot and upgrades future library-owned format changes.

```ts
import {
  createActor,
  PersistedSnapshotFormatError,
  upgradePersistedSnapshot
} from 'xstate';

let actor;
try {
  const snapshot = upgradePersistedSnapshot(JSON.parse(stored));
  actor = createActor(machine, { snapshot });
} catch (error) {
  if (!(error instanceof PersistedSnapshotFormatError)) throw error;
  // Stored snapshot is unreadable by this XState version; start fresh.
  actor = createActor(machine);
}
actor.start();
```
