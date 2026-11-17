---
'xstate': patch
'@xstate/effect': patch
---

Ignore queued timer notifications from cancelled schedulings when a replacement reuses the same ID. Replacements wait for their own deadlines in native and Effect actors.

Custom timer hosts must preserve the scheduling key's `occurrence` in the firing event. Exclude `occurrence` from logical replacement and cancellation lookup keys.
