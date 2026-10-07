---
"xstate": patch
---

Return false from `snapshot.can()` on terminal snapshots without evaluating transitions. Active snapshot dry runs still propagate evaluation errors; document that they do not execute state error recovery. Narrow known reserved machine-event handlers to their actual payloads and reject misspelled or unknown reserved prefixes when event schemas close the union.
