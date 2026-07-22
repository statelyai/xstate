---
"xstate": patch
---

`sendParent(...)` is now a no-op when the actor has no parent, instead of throwing an error. The docs already stated it sends "if it exists"; this change makes the runtime match that promise.

```ts
const machine = createMachine({
  initial: 'init',
  states: {
    init: {
      // Previously threw "Unable to send event to actor '#_parent' from machine '(machine)'."
      // Now silently does nothing when there is no parent.
      entry: sendParent({ type: 'CHILD_INIT' })
    }
  }
});
createActor(machine).start(); // no longer errors
```
