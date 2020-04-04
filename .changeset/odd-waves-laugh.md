---
'xstate': minor
---

Send an event to multiple targets by providing a list of references for a _send_ action creator's `.to` property: E.g.:

```js
send('SOME_EVENT', to: ['actor1', 'invokedMachineId2'])
...
send('SOME_EVENT', to: (ctx, evt) => [ctx.actor1, ctx.actor2, ...evt.addtionalTargets])
```
