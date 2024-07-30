---
'xstate': patch
---

Fix an issue where `clearTimeout(undefined)` was sometimes being called, which can cause errors for some clock implementations. See https://github.com/statelyai/xstate/issues/5001 for details.
