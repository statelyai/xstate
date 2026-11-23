---
"xstate": patch
---

Report actor failures at most once. A late subscription with an `error` callback still receives the failure and can suppress a pending host report.

When an actor has an `onUnhandledEvent` callback, use it to report unhandled events in place of the default development warning.
