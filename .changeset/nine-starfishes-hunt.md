---
'@xstate/store': minor
---

Added async atoms:

```typescript
const atom = createAsyncAtom(async () => {
  const response = await fetch(`/api/something`);
  return response.json();
});

atom.subscribe((state) => {
  // Status can be 'pending', 'fulfilled', or 'rejected'
  if (state.status === 'fulfilled') {
    console.log(state.data);
  }
});
```
