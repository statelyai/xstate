---
'xstate': minor
---

The machine can now be safely JSON-serialized, using `JSON.stringify(machine)`. The shape of this serialization is defined in `machine.schema.json` and reflected in `machine.definition`.

Note that `onEntry` and `onExit` have been deprecated in the definition in favor of `entry` and `exit`.
