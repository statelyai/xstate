---
'@xstate/scxml': patch
---

An SCXML document without a `name` creates a machine without an `id` (`machine.id` is `''`) instead of one named `(machine)`, matching `createMachine`. The `_name` system variable is `''` for such documents.
