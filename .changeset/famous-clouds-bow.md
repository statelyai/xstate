---
"xstate": patch
---

Added a dev-only error when `forwardTo` accidentally ends up trying to forward an event to an undefined actor. Such a situation indicates a logical error and risks an infinite loop.
