---
'xstate': minor
---

added support for `actor.system.subscribe` to subscribe to registration and unregistration events within an actor's system.

you can use `actor.system.subscribe` in two ways:

- `actor.system.subscribe(event => ...)` subscribes to all registration/unregistration events occurring within the system
- `actor.system.subscribe(systemId, event => ...)` subscribes to the registration/unregistration events of that given systemId.

`actor.system.subscribe` returns a `Subscription` object you can `.unsubscribe` to at any time.
