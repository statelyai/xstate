---
'xstate': patch
---

The default `clock` methods (`setTimeout` and `clearTimeout`) are now invoked properly with the global context preserved for those invocations which matter for some JS environments. More details can be found in the corresponding issue: [#1703](https://github.com/davidkpiano/xstate/issues/1703).
