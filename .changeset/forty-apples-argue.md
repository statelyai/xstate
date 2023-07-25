---
'xstate': major
---

All builtin action creators (`assign`, `sendTo`, etc) are now returning _functions_. They exact shape of those is considered an implementation detail of XState and users are meant to only pass around the returned values.
