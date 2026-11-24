---
'xstate': patch
'@xstate/scxml': patch
---

Reject seconds duration strings without a number, such as `s` and `.s`, instead of treating them as zero milliseconds. Async actors reject unparseable timeouts without starting work. Configured delays with those names still work, including zero-valued delays loaded from JSON or SCXML configuration.
