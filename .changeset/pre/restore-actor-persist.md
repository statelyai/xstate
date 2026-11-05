---
'xstate': minor
---

Restoring a persisted snapshot moved out of `createActor` into `restoreActor`, exported from the new `xstate/persist` entry point. `createActor` only starts fresh actors; passing `snapshot` throws with the replacement.

```ts
// Before
const actor = createActor(machine, { snapshot: persisted });

// After
import { restoreActor } from 'xstate/persist';

const actor = restoreActor(machine, persisted);
```

`restoreActor(logic, snapshot, options?)` works for any actor logic and accepts the `createActor` options except `input`. Pass `system` to restore into a system from `createSystem()`:

```ts
const actor = restoreActor(machine, persisted, { system });
```

Machine snapshots are validated and migrated, and invoked and spawned children are restored. A snapshot that cannot be restored produces an actor with an `'error'` snapshot. `machine.restoreSnapshot()` is removed.

`machine.snapshotSchema` and `machine.eventSchema` are now functions:

```ts
// Before
await machine.snapshotSchema['~standard'].validate(value);
await machine.eventSchema['~standard'].validate(input);

// After
import { eventSchema } from 'xstate';
import { snapshotSchema } from 'xstate/persist';

await snapshotSchema(machine)['~standard'].validate(value);
await eventSchema(machine)['~standard'].validate(input);
```

`machineVersions([...])` accepts machines and `{ id, version, snapshotSchema, eventSchema }` descriptors as before.
