---
'xstate': minor
---

Improved type inference for `InvokeConfig['data']`. This has required renaming `data` property on `StateNode` instances to `doneData`. This property was never meant to be a part of the public API, so we don't consider this to be a breaking change.
