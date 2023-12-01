---
'@xstate/svelte': major
---

The `useMachine(machine)` hook now returns `{ snapshot, send, actorRef }` instead of `{ state, send, service }`:

```diff
const {
- state,
+ snapshot,
  send,
- service
+ actorRef
} = useMachine(machine);
```
