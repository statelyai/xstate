---
'xstate': patch
---

This change carries forward the typestate type information encoded in the arguments of the following functions and assures that the return type also has the same typestate type information:

- Cloned state machine returned by `.withConfig`.
- `.state` getter defined for services.
- `start` method of services.
