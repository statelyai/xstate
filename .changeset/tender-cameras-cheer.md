---
'xstate': patch
---

Sending an event to a stopped actor no longer throws when the event contains unserializable data (e.g. circular references). Previously, the development-only warning that an event was sent to a stopped actor used `JSON.stringify` on the event, which could throw and mask the intended warning. The warning is now emitted safely regardless of the event's contents.
