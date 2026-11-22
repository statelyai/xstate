---
"xstate": patch
---

Breaking change in v6 beta. A transition between parallel regions now exits and reenters the common parallel state, matching SCXML. Untargeted regions restart at their initial states, entry and exit handlers run again, and invoked actors in exited states stop. To move only the receiving region, raise an event with `enq.raise(...)` and handle it inside that region.
