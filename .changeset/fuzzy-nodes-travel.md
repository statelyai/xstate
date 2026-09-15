---
'xstate': patch
---

Fixed metadata types in generic history values, snapshot nodes, and directed graph results. These containers now accept arbitrary state and transition metadata consistently with `AnyStateNode` and `AnyTransitionDefinition`, avoiding unsafe-type warnings when inspecting machines through generic APIs.
