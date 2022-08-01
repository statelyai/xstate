---
'xstate': patch
---

author: @Andarist
author: @davidkpiano

Make it impossible to exit a root state. For example, this means that root-level transitions specified as external transitions will no longer restart root-level invocations. See [#3072](https://github.com/statelyai/xstate/issues/3072) for more details.
