---
'xstate': patch
---

There are two new helper types for extracting `context` and `event` types:

- `ContextFrom<T>` which extracts the `context` from any type that uses context
- `EventsFrom<T>` which extracts the `events` (which extend `EventObject`) from any type which uses events
