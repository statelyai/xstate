---
'@xstate/react': minor
---

The `actor` passed to `useSelector(actor, selector)` is now allowed to be `undefined` for an actor that may not exist yet. For actors that may be `undefined`, the `snapshot` provided to the `selector` function can also be `undefined`:

```ts
const count = useSelector(maybeActor, (snapshot) => {
  // `snapshot` may be undefined
  return snapshot?.context.count;
});

count; // number | undefined
```
