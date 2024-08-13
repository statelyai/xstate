---
'@xstate/store': minor
---

You can now inspect XState stores using the `.inspect(inspector)` method:

```ts
import { someStore } from './someStore';

someStore.inspect((inspEv) => {
  console.log(inspEv);
  // logs "@xstate.event" events and "@xstate.snapshot" events
  // whenever an event is sent to the store
});
// The "@xstate.actor" event is immediately logged
```
