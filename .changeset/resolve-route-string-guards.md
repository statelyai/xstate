---
'xstate': patch
---

Fixed route transition guards so named guards registered with `setup({ guards })` are resolved for `route.guard`.

```ts
const machine = setup({
  guards: {
    isReady: ({ context }) => context.ready
  }
}).createMachine({
  states: {
    review: {
      id: 'review',
      route: {
        guard: 'isReady'
      }
    }
  }
});
```
