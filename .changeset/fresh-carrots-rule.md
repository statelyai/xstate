---
'@xstate/react': minor
---

The `useService(...)` hook will be deprecated, since services are also actors. In future versions, the `useActor(...)` hook should be used instead:

```diff
-const [state, send] = useService(service);
+const [state, send] = useActor(service);
```
