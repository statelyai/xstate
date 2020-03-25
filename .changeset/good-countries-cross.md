---
'xstate': minor
---

Added support for conditional actions. It's possible now to have actions executed based on conditions using following:

```js
entry: [
  choose([
    { cond: ctx => ctx > 100, actions: raise('TOGGLE') },
    {
      cond: 'hasMagicBottle',
      actions: [assign(ctx => ({ counter: ctx.counter + 1 }))]
    },
    { actions: ['fallbackAction'] }
  ])
];
```

It works very similar to the if-else syntax where only the first matched condition is causing associated actions to be executed and the last ones can be unconditional (serving as a general fallback, just like else branch).
