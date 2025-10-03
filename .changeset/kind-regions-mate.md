---
'@xstate/store': patch
---

Fix: `trigger` methods now work when passed directly as event handlers, even for events with no payload. Before, the React `event.type` would overwrite the intended event type.
