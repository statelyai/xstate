---
'xstate': major
---

Restoring persisted state is now done by passing the state into the `state: ...` property of the `interpret` options argument:

```diff
-interpret(machine).start(state);
+interpret(machine, { state }).start();
```

The persisted state is obtained from an actor by calling `actor.getPersistedState()`:

```ts
const actor = interpret(machine).start();

const persistedState = actor.getPersistedState();

// ...

const restoredActor = interpret(machine, {
  state: persistedState
}).start();
```
