---
'@xstate/fsm': major
---

The `.send(...)` method on `interpreter.send(...)` now requires the first argument (the event to send) to be an _object_, e.g. `{ type: 'someEvent' }`.

```diff
-actor.send('SOME_EVENT')
+actor.send({ type: 'SOME_EVENT' })
```
