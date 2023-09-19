---
'xstate': major
---

Typings for `Typestate` have been removed. The reason for this is that types for typestates needed to be manually specified, which is unsound because it is possible to specify _impossible_ typestates; i.e., typings for a state's `value` and `context` that are impossible to achieve.
