---
'xstate': minor
---

Expressions can now be used in the `stop()` action creator:

```js
// ...
actions: stop((context) => context.someActor);
```
