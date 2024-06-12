---
'xstate': patch
---

The `actor._processingStatus` property is now public, and is used to determine the processing status of the actor:

- `0` means the actor is not started
- `1` means the actor is started and running
- `2` means the actor is stopped
