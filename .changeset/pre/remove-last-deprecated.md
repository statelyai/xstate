---
'xstate': minor
---

### Removed

The deprecated top-level `internalEvents` machine config key and the deprecated `state` actor option are removed.

Declare private events in `schemas.internalEvents`:

```ts
// Before
createMachine({
  schemas: { events: { start: z.object({}), tick: z.object({}) } },
  internalEvents: ['tick'] as const
  // ...
});

// After
createMachine({
  schemas: {
    events: { start: z.object({}) },
    internalEvents: { tick: z.object({}) }
  }
  // ...
});
```

Restore a persisted snapshot with the `snapshot` option:

```ts
// Before
createActor(machine, { state: persistedSnapshot });

// After
createActor(machine, { snapshot: persistedSnapshot });
```

In development builds, a config with a top-level `internalEvents` key throws an error naming `schemas.internalEvents`, and passing `state` to `createActor(...)` throws an error naming `snapshot`.
