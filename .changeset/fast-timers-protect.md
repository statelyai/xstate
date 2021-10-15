---
'@xstate/react': patch
---

author: @Andarist
author: @davidkpiano
author: @VanTanev

The `useSelector(...)` hook now works as expected when the `actor` passed in changes. The hook will properly subscribe to the new `actor` and select the desired value. See [#2702](https://github.com/statelyai/xstate/issues/2702)
