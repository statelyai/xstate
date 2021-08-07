---
'xstate': patch
---

The custom `.toString()` method on action objects is now removed which improves performance in larger applications (see [#2488](https://github.com/statelyai/xstate/discussions/2488) for more context).
