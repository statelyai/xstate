---
'xstate': major
---

The `actor.onTransition(...)` method has been removed in favor of `.subscribe(...)`

```diff
 const actor = interpret(machine)
-  .onTransition(...)
-  .start();
+actor.subscribe(...);
+actor.start();
```
