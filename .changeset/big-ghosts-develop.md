---
'xstate': patch
---

You can now use a wildcard to listen for _any_ emitted event from an actor:

```ts
actor.on('*', (emitted) => {
  console.log(emitted); // Any emitted event
});
```
