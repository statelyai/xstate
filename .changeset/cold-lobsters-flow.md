---
'xstate': patch
---

The `tags` property was missing from state's definitions. This is used when converting a state to a JSON string. Since this is how we serialize states within [`@xstate/inspect`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-inspect) this has caused inspected machines to miss the `tags` information.
