---
'xstate': patch
---

Run callback cleanup before starting its replacement when a `sendBack` event makes the parent reenter the invoking state. Preserve the order of outgoing events and completion notifications.
