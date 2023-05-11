---
'@xstate/react': major
---

Implementations for machines on `useMachine` and `useInterpret` hooks should go directly on the machine via `machine.provide(...)`, and are no longer allowed to be passed in as options.

```diff
-const [state, send] = useMachine(machine, {
-  actions: {
-    // ...
-  }
-});
+const [state, send] = useMachine(machine.provide({
+  actions: {
+    // ...
+  }
+}));
```

`@xstate/react` will detect that the machine's config is still the same, and will not produce the "machine has changed" warning.
