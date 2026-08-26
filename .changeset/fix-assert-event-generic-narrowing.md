---
'xstate': patch
---

fix(core): fix `assertEvent` narrowing when the event type is behind a generic type parameter

Previously, calling `assertEvent` inside a function whose event parameter was typed with a generic (e.g. `function f<TEvent extends SomeEventUnion>(event: TEvent)`) would compile, but every property access on `event` afterward would fail to type-check with a "Property does not exist" error. This is now fixed - `assertEvent` narrows generic event parameters the same way it narrows concrete ones, while still rejecting invalid event descriptors at compile time.

`assertEvent` also keeps narrowing events whose `type` field is a union of literals (e.g. `{ type: 'a' | 'b'; value: string }`) when asserting one of those literals, for both concrete and generic event parameters.
