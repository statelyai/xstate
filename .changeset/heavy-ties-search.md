---
'xstate': major
---

Invoked actors can now be deeply persisted and restored. When the persisted state of an actor is obtained via `actor.getPersistedState()`, the states of all invoked actors are also persisted, if possible. This state can be restored by passing the persisted state into the `state: ...` property of the `interpret` options argument:

```diff
-interpret(machine).start(state);
+interpret(machine, { state }).start();
```
