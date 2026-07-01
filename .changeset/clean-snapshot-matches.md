---
'xstate': patch
---

Fix `snapshot.matches(...)` narrowing so repeated checks like `snapshot.matches('loaded') || snapshot.matches('failed')` compile correctly.
