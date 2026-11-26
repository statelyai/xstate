---
'xstate': patch
---

Partial wildcard descriptors now include the bare prefix event in their types, matching runtime behavior. `'feedback.*'` matches `feedback` as well as `feedback.good`, so:

- `on: { 'feedback.*': ... }` handlers, `assertEvent(event, 'feedback.*')` and `ExtractEvent<TEvent, 'feedback.*'>` keep the `feedback` event;
- a `'feedback.*'` key in `schemas.events` also declares a sendable `feedback` event, and a `'change.*'` key in `schemas.internalEvents` keeps `change` out of the events an actor accepts from outside.

Accessing a payload that only `feedback.good` carries now requires narrowing `event.type` first.
