---
'@xstate/store': minor
---

Pass an `AbortSignal` to `createAsyncAtom(...)` getters and ignore stale async results after recomputation.

```ts
const user = createAsyncAtom(async ({ signal }) => {
  const response = await fetch('/user', { signal });
  return response.json();
});
```
