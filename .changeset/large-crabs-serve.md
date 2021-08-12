---
'xstate': patch
---

A race condition occurred when a child service is immediately stopped and the parent service tried to remove it from its undefined state; this has been fixed, and the race condition no longer occurs. See https://github.com/statelyai/xstate/issues/2507 for details.
