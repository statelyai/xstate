---
'xstate': minor
---

You can now specify action types for machines:

```ts
createMachine({
  types: {} as {
    actions: { type: 'greet'; params: { name: string } };
  },
  entry: [
    {
      type: 'greet',
      params: {
        name: 'David'
      }
    },
    // @ts-expect-error
    { type: 'greet' },
    // @ts-expect-error
    { type: 'unknownAction' }
  ]
  // ...
});
```
