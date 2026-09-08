---
'xstate': patch
---

Fixed framework adapter snapshot inference in projects that enable `exactOptionalPropertyTypes`.

```ts
const actor = createActor(machine);
const count = useSelector(actor, (snapshot) => snapshot.context.count);
```
