---
'xstate': patch
---

When using a model type in `createMachine<typeof someModel>(...)`, TypeScript will no longer compile machines that are missing the `context` property in the machine configuration:

```ts
const machine = createMachine<typeof someModel>({
  // missing context - will give a TS error!
  // context: someModel.initialContext,
  initial: 'somewhere',
  states: {
    somewhere: {}
  }
});
```
