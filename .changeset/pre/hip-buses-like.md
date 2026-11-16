---
'xstate': patch
---

Fix targetless transitions with `reenter: true` unexpectedly running entry behavior. Transitions without a target now preserve the active states without running exit or entry behavior, while still applying context updates and transition effects.
