---
'xstate': patch
---

Fixed an issue with exit actions being called in random order when stopping a machine. They should always be called in the reversed document order (the ones defined on children should be called before the ones defined on ancestors and the ones defined on states appearing later in the code should be called before the ones defined on their sibling states).
