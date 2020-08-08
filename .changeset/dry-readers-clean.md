---
'xstate': major
---

Passing an assigner function to `assign((ctx, e) => ...)` will now be expected to assign to the _entire_ `context`, instead of just partially.

```js
// ...
{
  context: {
    name: 'David',
    temp: 'value'
  },
  // ...
  entry: assign((ctx, event) => {
    return {
      name: event.name
    }
  })
}

// The context will now be, e.g.:
// { name: 'Jenny' }
// instead of:
// { name: 'Jenny', temp: 'value' }
```
