---
'xstate': major
---

The `interpret(...)` function has been deprecated and renamed to `createActor(...)`:

```diff
-import { interpret } from 'xstate';
+import { createActor } from 'xstate';

-const actor = interpret(machine);
+const actor = createActor(machine);
```
