---
'xstate': patch
---

`snapshot.matches(...)` accepts a state value whose leaves are not literals, such as `{ checkout: string }`, as it accepts `string` and `StateValue`. Values are checked per position: a non-literal leaf is accepted at its own position, and every literal key and child beside it must still name a state, so `{ nope: 'payment', checkout: step }` is rejected.
