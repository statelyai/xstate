---
'xstate': patch
---

Fix `machineFromJSON` transitions using `@xstate.assign` so they preserve context updates from exit actions and other parallel regions.
