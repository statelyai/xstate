---
'xstate': patch
---

Fixed an issue with `EventFrom` not being able to extract events that had a union of strings as their `type` (such as `{ type: 'INC' | 'DEC'; value: number; }`).
