---
'xstate': patch
---

Fixed an issue with interpreters started using a persisted state not being "resolved" in full. This could cause some things, such as `after` transitions, not being executed correctly after starting an interpreter like this.
