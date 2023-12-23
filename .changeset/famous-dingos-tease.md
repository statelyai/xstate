---
'xstate': minor
---

An actor being stopped can now be observed:

```ts
const actor = createActor(machine);

actor.subscribe({
  next: (snapshot) => {
    if (snapshot.status === 'stopped') {
      console.log('Actor stopped');
    }
  }
});

actor.start();

// ...

actor.stop();
```
