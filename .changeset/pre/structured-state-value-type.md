---
'xstate': patch
---

`snapshot.value` is now structurally typed from the machine config instead of the generic `StateValue` type. Flat machines get a union of state keys, and parallel machines get an object type with a key per region:

```ts
const machine = createMachine({
  type: 'parallel',
  states: {
    bold: { initial: 'off', states: { off: {}, on: {} } },
    italic: { initial: 'off', states: { off: {}, on: {} } }
  }
});

const value = createActor(machine).getSnapshot().value;
// { bold: 'off' | 'on'; italic: 'off' | 'on' }
```
