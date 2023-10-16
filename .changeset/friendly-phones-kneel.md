---
'xstate': minor
---

Params of `actions` and `guards` can now be resolved dynamically

```ts
createMachine({
  types: {} as {
    actions: { type: 'greet'; params: { surname: string } } | { type: 'poke' };
  },
  entry: {
    type: 'greet',
    params: ({ context }) => ({
      surname: 'Doe'
    })
  }
});
```
