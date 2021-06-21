---
'xstate': patch
---

The global `process` variable is now checked for existence before trying to read the `NODE_ENV` environment variable.
