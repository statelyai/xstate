---
'@xstate/react': patch
---

The `useSelector(...)` hook now works as expected when the `actor` passed in changes. The hook will properly subscribe to the new `actor` and select the desired value. See #2702
