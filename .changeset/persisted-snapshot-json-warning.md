---
'xstate': patch
---

In development builds, `getPersistedSnapshot()` warns when `context`, `output`, `error` or state inputs contain a value that does not survive a JSON round-trip: a function, symbol, `BigInt`, `NaN` or `Infinity`, `Map`, `Set` or circular reference. The warning names the path of the first such value.
