---
'xstate': minor
---

Leftover v5 configuration now throws in every build instead of only in development, so it cannot be silently ignored:

- `createMachine(config, implementations)` and `setup(...).createMachine(config, implementations)` throw. Declare implementations in `setup({ ... })` or pass them to `machine.provide({ ... })`.
- `services`, `activities` and `devTools` in a machine config throw. They previously only warned in development.
- `createActor(...)` throws on an option it does not read. Removed options (`systemId`, `state`, `devTools`, `parent`, `deferEvents`, `execute`) throw with their replacement; any other unknown option throws with the list of supported options.

```ts
createActor(machine, { systemId: 'payments' });
// Error: The "systemId" actor option was renamed. Use "registryKey": createActor(logic, { registryKey }), and look the actor up with system.get(registryKey).
```

`predictableActionArguments`, `preserveActionOrder` and `strict` change nothing in v6 and still only warn in development.
