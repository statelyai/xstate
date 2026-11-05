---
'xstate': patch
---

`self` in actions, transition functions, context factories, input mappers and delay functions is typed as a machine actor ref instead of `any` in its children, meta and state-schema positions. Delay and `after` functions now receive the machine's emitted event type.
