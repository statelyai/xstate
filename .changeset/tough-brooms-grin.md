---
'xstate': minor
---

Add `actor.select(selector, equalityFn?)` method to derive a `Readable<TSelected>` from an actor's snapshot. The returned object has `.subscribe()` (only emits when the selected value changes, using `Object.is` by default) and `.get()` for synchronous access.

```ts
const actor = createActor(machine);
actor.start();

const count = actor.select((snap) => snap.context.count);

count.get(); // current value

count.subscribe((value) => {
  console.log(value); // only fires when count changes
});
```
