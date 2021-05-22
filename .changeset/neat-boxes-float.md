---
'xstate': minor
---

All spawned and invoked actors now have a `.getSnapshot()` method, which allows you to retrieve the latest value emitted from that actor. That value may be `undefined` if no value has been emitted yet.

```js
const machine = createMachine({
  context: {
    promiseRef: null
  },
  initial: 'pending',
  states: {
    pending: {
      entry: assign({
        promiseRef: () => spawn(fetch(/* ... */), 'some-promise')
      })
    }
  }
});

const service = interpret(machine)
  .onTransition((state) => {
    // Read promise value synchronously
    const resolvedValue = state.context.promiseRef?.getSnapshot();
    // => undefined (if promise not resolved yet)
    // => { ... } (resolved data)
  })
  .start();

// ...
```
