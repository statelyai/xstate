---
'xstate': patch
---

Fixed an issue with parallel regions not always being correctly reentered on external transitions of the containing parallel state targeting another region within that parallel state.
