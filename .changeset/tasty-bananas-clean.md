---
'xstate': patch
---

`InterpreterFrom` and `ActorRefFrom` types used on machines with typegen data should now correctly return types with final/resolved typegen data. The "final" type here means a type that already encodes the information that all required implementations have been provided. Before this change this wouldn't typecheck correctly:

```ts
const machine = createMachine({
  // this encodes that we still expect `myAction` to be provided
  tsTypes: {} as Typegen0
});
const service: InterpreterFrom<typeof machine> = machine.withConfig({
  actions: {
    myAction: () => {}
  }
});
```
