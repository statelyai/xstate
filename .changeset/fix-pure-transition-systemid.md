---
'xstate': patch
---

Fixed `initialTransition` (and `transition`) throwing `"Actor with system ID '...' already exists"` when the machine contains an `invoke` with a `systemId`.

**Root cause:** `createInertActorScope` used `createActor(logic)` internally, which eagerly ran `getInitialSnapshot` during construction and registered any `systemId`-carrying child actors in the system. When the caller then ran `getInitialSnapshot` (or `transition`) via the returned scope, the same system was reused, causing the duplicate-registration error.

**Fix:** After creating the internal actor, `createInertActorScope` now replaces the actor's system reference with a freshly-created system. Child actors spawned by the subsequent caller-driven `getInitialSnapshot` / `transition` invocation therefore register into a clean system with no pre-existing entries.

```ts
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      invoke: {
        src: fromPromise(async () => 42),
        systemId: 'myActor'  // previously caused: "Actor with system ID 'myActor' already exists"
      }
    }
  }
});

// Now works correctly — returns [snapshot, actions] without throwing
const [snapshot, actions] = initialTransition(machine);
```
