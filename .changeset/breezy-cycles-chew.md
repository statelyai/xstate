---
'xstate': patch
---

Fixed an issue with a reference to `@types/node` being inserted into XState's compiled output. This could cause unexpected issues in projects expecting APIs like `setTimeout` to be typed with browser compatibility in mind.
