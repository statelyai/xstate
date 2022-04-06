---
'@xstate/inspect': patch
---

Remove the selective stringify serialization for machine. The serialize function failed to be able to prevent serialization of extremely deep values, specifically inside context, that are referenced in multiple places inside the machine.
This serialization was unpreventable and could cause the browser to hang for long periods of time.
