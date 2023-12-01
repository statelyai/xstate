---
'xstate': major
---

The `.send(...)` method on `interpreter.send(...)` now requires the first argument (the event to send) to be an _object_; that is, either:

- an event object (e.g. `{ type: 'someEvent' }`)
- an SCXML event object.

The second argument (payload) is no longer supported, and should instead be included within the object:

```diff
-actor.send('SOME_EVENT')
+actor.send({ type: 'SOME_EVENT' })

-actor.send('EVENT', { some: 'payload' })
+actor.send({ type: 'EVENT', some: 'payload' })
```
