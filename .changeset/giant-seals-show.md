---
'xstate': minor
---

Add evaluated guards to microstep event for debugging guard evaluations during transitions. When using the `inspect` option, guard evaluation events are now emitted showing the guard name, parameters, and result (true/false). This makes it easier to debug why transitions didn't happen as expected.
