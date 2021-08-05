---
'@xstate/inspect': patch
---

Fixed a minor issue with sometimes sending `undefined` state to the inspector which resulted in an error being thrown in it when resolving the received state. The problem was very minor as no functionality was broken because of it.
