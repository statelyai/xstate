---
'xstate': patch
---

Make `spawn` input required when defined inside referenced actor:

```ts
const childMachine = createMachine({
  types: { input: {} as { value: number } }
});

const machine = createMachine({
  types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
  context: ({ spawn }) => ({
    ref: spawn(
      childMachine,
      // Input is now required!
      { input: { value: 42 } }
    )
  })
});
```
