---
"xstate": patch
---

Accept `route: true` in machine configs and let transition functions call `enq.raise({ type: 'xstate.route', to: '#id' })`.

Keep inferred declarations compact when a machine defines multiple routes.
