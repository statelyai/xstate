---
'xstate': major
---

A machine that declares `version` must also declare `id`, because persisted snapshots record the machine as `{ id, version }`. `createMachine`, `setup(...).createMachine` and `MachineJSON` report a missing `id` as a type error, and creating such a machine throws `Machine with version '2' must declare an id.` Machines without a `version` keep `id` optional.

```ts
// Before
createMachine({ version: '2', initial: 'idle', states: { idle: {} } });

// After
createMachine({
  id: 'order',
  version: '2',
  initial: 'idle',
  states: { idle: {} }
});
```
