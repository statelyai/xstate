---
"xstate": patch
---

`createFSM` ignores inherited state definitions when looking up outgoing transitions. Own state definitions, including state maps with a null prototype, continue to work.
