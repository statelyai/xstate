---
'xstate': patch
---

The typings for the raise() action have been fixed to allow any event to be raised. This typed behavior will be refined in version 5, to limit raised events to those that the machine accepts.
