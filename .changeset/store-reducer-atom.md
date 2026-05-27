---
'@xstate/store': minor
---

Add `createReducerAtom(...)` for reducer-driven atoms.

```ts
const count = createReducerAtom(0, (state, event: { type: 'inc' }) => {
  if (event.type === 'inc') {
    return state + 1;
  }
  return state;
});

count.send({ type: 'inc' });
```
