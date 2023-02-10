---
'xstate': major
---

The `interpret(...)` function now accepts `input` in the second argument, which passes input data in the `"xstate.init"` event:

```js
const greetMachine = createMachine({
  context: ({ input }) => ({
    greeting: `Hello ${input.name}!`
  })
  // ...
});

const actor = interpret(greetMachine, {
  // Pass input data to the machine
  input: { name: 'David' }
}).start();
```
