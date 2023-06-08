---
'@xstate/fsm': major
---

This change adds support for using "\*" as a wildcard event type in machine configs.

Because that event type previously held no special meaning, it was allowed as an event type both in configs and when transitioning and matched as any other would. As a result of changing it to be a wildcard, any code which uses "\*" as an ordinary event type will break, making this a major change.
