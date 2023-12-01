---
'xstate': major
---

The `actor.onDone(...)` method is removed. Use `actor.subscribe({ complete() {... } })` instead.

```diff
- actor.onDone(() => { ... })
+ actor.subscribe({
+  complete() {
+    // ...
+  }
+})
```
