---
"@xstate/store": patch
---

Preserve the latest persisted state when effects or subscriptions synchronously trigger another event. Snapshot and event persistence now retain commit order with immediate or throttled writes.
