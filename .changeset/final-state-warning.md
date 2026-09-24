---
'xstate': patch
---

In development, `createMachine` now warns when a top-level final state declares `invoke`, `on` or `after`. Entering that state completes the machine, so these never run.
