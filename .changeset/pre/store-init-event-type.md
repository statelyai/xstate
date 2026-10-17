---
'@xstate/store': major
---

The event in the initial `@xstate.transition` inspection record is `{ type: 'xstate.init' }` (previously `{ type: '@xstate.init' }`). Events use the `xstate.` prefix; `@xstate.` is reserved for inspection record and effect types.

```diff
  store.inspect((inspectionEvent) => {
-   if (inspectionEvent.event.type === '@xstate.init') {
+   if (inspectionEvent.event.type === 'xstate.init') {
      // initial snapshot
    }
  });
```
