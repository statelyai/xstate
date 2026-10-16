---
'xstate': patch
---

`snapshot.matches(...)` accepts a state value whose leaves are not literals, such as `{ checkout: string }`, as it accepts `string` and `StateValue`. Literal values that name no state are still rejected.
