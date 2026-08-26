---
'xstate': patch
---

Fixed a spurious "Custom actions should not call \`…\` directly, as it is not imperative" warning that was logged when a custom action synchronously sent an event to another actor that resolved an `enqueueActions` block using builtin action creators (e.g. `enqueue.assign(…)` or `enqueue.sendTo(self, …)`).
