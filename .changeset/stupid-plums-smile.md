---
'xstate': minor
---

Added a `StateValueFrom` helper that can be used to extract valid state values from a machine. This might specifically be useful with typegen because typegenless `state.matches` accepts `any` anyway.
