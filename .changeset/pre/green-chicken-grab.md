---
"xstate": patch
---

Fix nested and parallel state value inference for machines declaring `setup({ states })` when `exactOptionalPropertyTypes` is enabled. Both forms of `snapshot.matches(...)` now accept valid nested states:

```ts
snapshot.matches({ b: 'x' });
snapshot.matches('b.x');
```
  
