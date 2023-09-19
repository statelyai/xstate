---
'xstate': major
---

The `interpret(...)` function now accepts `input` in the second argument, which passes input data in the `"xstate.init"` event:

```js
const greetMachine = createMachine({
  context: ({ input }) => ({
    greeting: `Hello ${input.name}!`
  }),
  entry: (_, event) => {
    event.type; // 'xstate.init'
    event.input; // { name: 'David' }
  }
  // ...
});

const actor = interpret(greetMachine, {
  // Pass input data to the machine
  input: { name: 'David' }
}).start();
```
