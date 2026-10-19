---
'@xstate/svelte': patch
---

The `snapshot` store returned by `useActor(…)` now reads the actor's current snapshot whenever it gains its first subscriber. Before, if the actor changed while nothing was subscribed to the store (for example, while the only component reading `$snapshot` was unmounted), the store kept showing the old snapshot until the next change. `useSelector(…)` already worked this way.
