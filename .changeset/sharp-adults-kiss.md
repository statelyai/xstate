---
'xstate': patch
---

There are two new helper types for extracting `context` and `event` types:

- `ContextFrom<T>` which extracts the `context` from any type that uses context
- `EventFrom<T>` which extracts the `event` type (which extends `EventObject`) from any type which uses events
