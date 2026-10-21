---
"xstate": patch
---

Export `getAllOwnEvents()` from `xstate/graph` so custom traversal events can retain invoke and delay events. Accept synthesized internal events in traversal options. Omit unknown function targets from static directed graphs and expose resolved targets in microstep inspection. Validate event schemas that explicitly declare their `type` discriminator.
