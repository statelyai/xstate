---
'@xstate/vue': major
---

The `useMachine(machine)` hook now returns `{ snapshot, send, service }` instead of `{ state, send, actorRef }`:

```diff
const {
- state,
+ snapshot,
  send,
- actorRef
+ service
} = useMachine(machine);
```
