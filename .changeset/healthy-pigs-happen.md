---
'xstate': minor
---

Inline actor logic is now permitted when named actors are present. Defining inline actors will no longer cause a TypeScript error:

```ts
const machine = setup({
  actors: {
    existingActor: fromPromise(async () => {
      // ...
    })
  }
}).createMachine({
  invoke: {
    src: fromPromise(async () => {
      // Inline actor
    })
    // ...
  }
});
```
