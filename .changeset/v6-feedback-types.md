---
"xstate": patch
---

Preserve context, internal-event, transition metadata, emitted-event, and concrete schema types in public helpers and provided machines. Fix declaration emit for state configurations with parameterized callbacks and registered actors. Reject incompatible `extend()` source replacements and nonexistent literal `matches()` states. Widen schema-free async outputs using ordinary TypeScript inference. Reduce validator state-constraint cost and check transforming schemas independently in every state.
