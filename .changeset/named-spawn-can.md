---
"xstate": patch
---

Fix `snapshot.can()` throwing when a transition calls `enq.spawn()` with a registered actor name.
