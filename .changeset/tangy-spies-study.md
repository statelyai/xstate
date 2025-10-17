---
'@xstate/store': minor
---

Add `skipEvent` option to `undoRedo()` to exclude certain events from undo/redo history.

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
      skipEvent: (event, snapshot) => event.type === 'log'
    }
  )
);
```
