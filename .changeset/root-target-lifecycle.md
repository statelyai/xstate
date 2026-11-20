---
"xstate": patch
---

Targeting the machine root from a descendant resets its children and keeps the root active. The root's initial transition still supplies input to its children. Set `reenter: true` to exit and reenter the root explicitly. Targeting a history state uses its selected default without rerunning its parent's initial transition.
