---
'xstate': patch
---

Remove `State['changed']`. A new instance of `State` is being created if there are matching transitions for the received event. If there are no matching transitions then the current state is being returned.
