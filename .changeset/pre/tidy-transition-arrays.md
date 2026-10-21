---
'xstate': patch
---

Transition arrays are no longer accepted by the v6 `createMachine(...)` authoring API. Use a transition function to select among targets:

```ts
createMachine({
  always: ({ context }) => {
    if (context.hour < 12) return { target: 'morning' };
    return { target: 'afternoon' };
  }
});
```

Serialized transition arrays remain supported by `createMachineFromConfig(...)`.
