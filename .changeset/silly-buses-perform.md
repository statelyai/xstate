---
'xstate': patch
---

Fixed an issue that prevented events sent from the exit actions of the invoking state to be delivered to the invoked actor (when leaving that state).
