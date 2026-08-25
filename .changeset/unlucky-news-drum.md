---
'xstate': minor
---

Added `onStop` handler to actors which allows registering callbacks that will be executed when an actor is stopped. This provides a way to perform cleanup or trigger side effects when an actor reaches its final state or is explicitly stopped.

```ts
const actor = createActor(someMachine);

actor.onStop(() => {
  console.log('Actor stopped');
});
```
