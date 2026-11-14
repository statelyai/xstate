---
'xstate': patch
---

Fix delayed transitions and delayed raised events taking an enabled `always` transition before handling the delayed event. They now handle the delayed event first, then reevaluate eventless transitions, preserving v5 ordering. A delayed send also no longer reevaluates the sender's eventless transitions before delivering its event.