---
'@xstate/store': minor
---

Add `skipEvents` option to `undoRedo()` to exclude certain events from undo/redo history.

```ts
const store = createStore(
  undoRedo(
    {
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 }),
        log: (ctx) => ctx // No state change
      }
    },
    {
      skipEvents: (event, snapshot) => event.type === 'log'
    }
  )
);
```
