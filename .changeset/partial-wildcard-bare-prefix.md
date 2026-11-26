---
'xstate': patch
---

Partial wildcard descriptors now include the bare prefix event in their types, matching runtime behavior. `'feedback.*'` matches `feedback` as well as `feedback.good`, so `on: { 'feedback.*': ... }` handlers, `assertEvent(event, 'feedback.*')` and `ExtractEvent<TEvent, 'feedback.*'>` keep the `feedback` event.

Accessing a payload that only `feedback.good` carries now requires narrowing `event.type` first.
