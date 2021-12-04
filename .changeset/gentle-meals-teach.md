---
'xstate': patch
---

Fixed an issue with stopped children sometimes starting their own child actors. This could happen when the child was stopped synchronously (for example by its parent) when transitioning to an invoking state.
