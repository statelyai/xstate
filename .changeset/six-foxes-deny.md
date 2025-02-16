---
'@xstate/store': minor
---

Added selectors to @xstate/store that enable efficient state selection and subscription:

- `select(store, selector)` function to create a "selector" entity where you can:
  - Get current value with `.get()`
  - Subscribe to changes with `.subscribe(callback)`
  - Only notify subscribers when selected value actually changes
  - Support custom equality functions for fine-grained control over updates

```ts
const store = createStore({
  context: {
    position: { x: 0, y: 0 },
    user: { name: 'John', age: 30 }
  },
  on: {
    setPosition: (context, event: { position: { x: number; y: number } }) => ({
      ...context,
      position: event.position
    })
  }
});

const position = select(store, (state) => state.context.position);

position.get(); // { x: 0, y: 0 }

position.subscribe((position) => {
  console.log(position);
});

store.trigger.setPosition({ x: 100, y: 200 });
// Logs: { x: 100, y: 200 }
```
