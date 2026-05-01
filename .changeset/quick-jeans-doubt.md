---
'@xstate/store': patch
---

Fix `atom.subscribe()` callbacks tracking dependencies from `.get()` calls inside the callback (fixes #5509). Previously, calling `otherAtom.get()` inside a subscription callback would cause the callback to re-run whenever `otherAtom` changed, even if the subscribed atom's value didn't change.
