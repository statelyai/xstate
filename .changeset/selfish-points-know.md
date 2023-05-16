---
'xstate': major
---

The `fromEventObservable` actor logic creator now accepts `input`:

```ts
const machine = createMachine({
  invoke: {
    src: fromEventObservable(({ input }) => /* ... */),
    input: {
      foo: 'bar'
    }
  }
});
```
