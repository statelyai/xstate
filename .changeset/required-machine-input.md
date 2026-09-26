---
'xstate': minor
---

`createActor(machine)` now requires `input` when the machine declares an input schema whose type does not accept `undefined`. Restoring from a persisted `snapshot` does not require `input`.

```ts
const machine = setup({
  schemas: { input: z.object({ id: z.string() }) }
}).createMachine({});

createActor(machine); // type error
createActor(machine, { input: { id: 'a' } }); // ok
createActor(machine, { snapshot: persisted }); // ok
```
