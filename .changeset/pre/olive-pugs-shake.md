---
'xstate': patch
---

`actor.getPersistedSnapshot()` is now assignable to `PersistedSnapshotFrom<typeof machine>`, so persisted snapshots can be annotated with the public type instead of `ReturnType<Actor<typeof machine>['getPersistedSnapshot']>`:

```ts
import { createActor, type PersistedSnapshotFrom } from 'xstate';

const snapshot: PersistedSnapshotFrom<typeof machine> =
  createActor(machine).getPersistedSnapshot();

snapshot.context; // typed from the machine
```

Event executors passed to `path.test()` from `xstate/graph` now receive the full event, payload included, instead of just `{ type }`:

```ts
await path.test({
  events: {
    // `event.card` used to require an `Extract<...>` cast
    pay: ({ event }) => ui.pay(event.card)
  }
});
```
