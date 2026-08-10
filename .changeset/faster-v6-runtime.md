---
'xstate': patch
---

Improve state machine actor throughput for event bursts, child delivery, and compound and parallel machines. Pure context-only transitions now avoid allocating actor runtime facilities.
