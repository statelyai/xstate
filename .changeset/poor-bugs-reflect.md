---
'@xstate/graph': minor
---

Options passed into graph functions (e.g., `getShortestPaths(machine, options)`) can now resolve `.events` based on the `state`:

```js
const countMachine = createMachine({
  initial: 'active',
  context: {
    count: 0
  },
  states: {
    active: {
      on: {
        ADD: {
          actions: assign({
            count: (context, event) => {
              return context.count + event.value;
            }
          })
        }
      }
    }
  }
});

const shortestPaths = getShortestPaths(countMachine, {
  events: {
    ADD: (state) => {
      // contrived example: if `context.count` is >= 10, increment by 10
      return state.context.count >= 10
        ? [{ type: 'ADD', value: 10 }]
        : [{ type: 'ADD', value: 1 }];
    }
  }
});

// The keys to the shortest paths will look like:
// "active" | { count: 0 }
// "active" | { count: 1 }
// "active" | { count: 2 }
// ...
// "active" | { count: 10 }
// "active" | { count: 20 }
// "active" | { count: 30 }
```
