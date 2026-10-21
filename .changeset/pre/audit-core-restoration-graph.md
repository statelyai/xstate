---
"xstate": patch
---

Restore callback subscriptions and active keyed effects. Retry interrupted local async steps while reusing completed outcomes and sharing concurrent same-key work. Pending step callers reject when their actor terminates. Interrupted external side effects require idempotency keys.

Keep SCXML condition errors and transition evaluation isolated between actors, and process condition errors without waiting for state entry.

Replay finite graph event sequences without exploring every reachable state, initialize graph traversal once, and support arbitrary serialized state and event keys. Improve adjacency traversal for large graphs. Keep simulated clocks usable after a timer callback throws.
