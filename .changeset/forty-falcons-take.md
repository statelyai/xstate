---
'xstate': patch
---

Apply SCXML exit and entry rules when a transition crosses between parallel regions. The parallel state exits and re-enters, untargeted regions reset to their initial states, and invoked actors restart when their states are re-entered. Competing transitions with overlapping exits follow the existing priority rules.

A parallel parent targeting one region still preserves its siblings by default. Explicit reentry within a region stays within that region.
