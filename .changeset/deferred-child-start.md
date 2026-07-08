---
'xstate': major
---

Invoked and spawned actors are no longer started directly by `actor.start()`. They now start as part of the transition that creates them (via an internal deferred start action), the same way other entry effects run.

The user-visible consequence: a child that fails synchronously while starting now surfaces that failure through the invoking state's `onError` transition instead of throwing out of `actor.start()`:

```ts
const machine = createMachine({
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: createAsyncLogic({
          run: () => {
            throw new Error('boom'); // sync failure on start
          }
        }),
        onError: 'failed'
      }
    },
    failed: {}
  }
});

const actor = createActor(machine).start(); // does not throw
actor.getSnapshot().value; // 'failed'
```

Restored (rehydrated) children that were active when a snapshot was persisted are still restarted on `actor.start()`, so persistence behavior is unchanged.
