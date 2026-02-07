---
'xstate': minor
---

Make actors async iterable:

```ts
const actor = createActor(machine);
actor.start();

for await (const snapshot of actor) {
  console.log(snapshot);
}
```
