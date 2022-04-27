---
'xstate': patch
---

Fixed an issue with typegen types not being able to provide events that had a union of strings as their `type` (such as `{ type: 'INC' | 'DEC'; value: number; }`).
