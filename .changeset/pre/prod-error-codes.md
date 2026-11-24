---
'xstate': patch
---

Production builds report errors and diagnostics as short codes. Each message names the code, the values that identify the failing state, event, or actor, and a link to its entry in the error code reference:

```text
XState error E1 ("services"). See https://github.com/statelyai/xstate/blob/next/docs/errors.md#e1
```

Development messages are unchanged. Error classes and names are the same in both builds.
