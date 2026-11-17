---
'xstate': patch
'@xstate/effect': patch
---

Ignore queued timer notifications from cancelled schedulings when a replacement reuses the same ID. Replacements wait for their own deadlines in native and Effect actors, including restored native timers. Preserve anonymous timer keys when named or built-in timers are also scheduled.

Custom timer hosts must preserve the scheduling key's `occurrence` in the firing event. Exclude `occurrence` from logical replacement and cancellation lookup keys.

Effect snapshot schemas must preserve the optional `nextTimerOccurrence` metadata.
