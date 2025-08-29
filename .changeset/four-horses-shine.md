---
'xstate': minor
---

Added `.createStateConfig(…)` to the setup API. This makes it possible to create state configs that are strongly typed and modular.

```ts
const lightMachineSetup = setup({
  // ...
});

const green = lightMachineSetup.createStateConfig({
  //...
});

const yellow = lightMachineSetup.createStateConfig({
  //...
});

const red = lightMachineSetup.createStateConfig({
  //...
});

const machine = lightMachineSetup.createMachine({
  initial: 'green',
  states: {
    green,
    yellow,
    red
  }
});
```
