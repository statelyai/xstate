---
'xstate': patch
---

The `clock` methods (`setTimeout`, `clearTimeout`) are now properly bound to the `global` scope internally (fixes #1703)
