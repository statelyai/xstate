---
'@xstate/store': patch
---

Fix computed `atom.subscribe()` callbacks not re-running after one of it's dependencies is synchronously updated inside the callback. Previously, calling `someDependency.set()` inside a subscription callback would prevent that subscription from being notified of future changes. This also affected store selector subscriptions which triggered an update to the store.
