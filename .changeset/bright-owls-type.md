---
"xstate": patch
---

`setup().createMachine()` now types transition functions under an object's `to` property. Their arguments and returned context and targets follow the same rules as direct function transitions, so a function can carry a `description` without losing type checks.
