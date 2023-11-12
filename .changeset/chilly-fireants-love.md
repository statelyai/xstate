---
'@xstate/vue': major
---

The `useMachine(machine)` hook now returns `{ snapshot, send }` instead of `{ state, send }`:

```diff
- const { state, send } = useMachine(machine);
+ const { snapshot, send } = useMachine(machine);
```
