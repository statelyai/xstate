---
"xstate": patch
---

Avoid repeating root entry effects without root exit effects when a descendant targets the machine root. Set `reenter: true` to exit and reenter the root explicitly.
