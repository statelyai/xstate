---
'xstate': patch
---

Fix `snapshot.matches(...)` narrowing so repeated checks like `snapshot.matches('loaded') || snapshot.matches('failed')` compile correctly, and make `StateFrom<typeof machine>` preserve the machine's concrete state value.
