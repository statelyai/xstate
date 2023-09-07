---
'xstate': patch
---

Allow the types to flow from `pure` to `raise` that it returns. It now should properly raise errors on attempts to raise non-defined events and it should allow all defined events to be raised.
