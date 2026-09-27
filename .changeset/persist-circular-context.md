---
'xstate': patch
---

Persisting a snapshot whose `context` contains a circular reference now throws a descriptive error instead of a `RangeError` (maximum call stack size exceeded). Shared references that are not circular still persist.

```ts
const node: Record<string, unknown> = {};
node.self = node;
const machine = createMachine({ id: 'tree', context: { node } });

createActor(machine).getPersistedSnapshot();
// Error: Cannot persist actor "tree": circular reference at context.node.self
```
