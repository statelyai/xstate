---
'xstate': patch
---

Restoring a persisted snapshot whose state value references a state that no longer exists on the machine now throws a descriptive error instead of crashing deep in the interpreter, e.g.:

```
Persisted snapshot references state 'reviewing' which does not exist on machine 'order-approval'.
```

Nested state values report the full state path (e.g. `'active.reviewing'`), and parallel state regions are validated as well.
