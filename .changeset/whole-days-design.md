---
'@xstate/store': minor
---

Computed atoms can now access their previous value via an optional second parameter:

```ts
const count = createAtom(1);
const double = createAtom<number>((_, prev) => count.get() + (prev ?? 0));
```
