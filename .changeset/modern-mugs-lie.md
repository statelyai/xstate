---
'@xstate/fsm': patch
---

`State['value']` is now correctly typed to `TState['value']`. It's important in situations when typestates are used as it now correctly is limited to values of those typestates and not widened to just `string`.
