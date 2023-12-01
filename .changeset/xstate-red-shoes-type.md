---
'xstate': major
---

The `pure()` and `choose()` action creators have been removed, in favor of the more flexible `enqueueActions()` action creator:

```ts
entry: [
  // pure(() => {
  //   return [
  //     'action1',
  //     'action2'
  //   ]
  // }),
  enqueueActions(({ enqueue }) => {
    enqueue('action1');
    enqueue('action2');
  })
];
```

```ts
entry: [
  // choose([
  //   {
  //     guard: 'someGuard',
  //     actions: ['action1', 'action2']
  //   }
  // ]),
  enqueueActions(({ enqueue, check }) => {
    if (check('someGuard')) {
      enqueue('action1');
      enqueue('action2');
    }
  })
];
```
