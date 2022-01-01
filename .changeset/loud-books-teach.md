---
'xstate': major
---

Target resolution improvements: delimiters in state node IDs now resolve to the state node from the path relative to the resolved state node ID:

```js
const machine = createMachine({
  // ...
  on: {
    SOME_EVENT: '#foo.bar' // resolves to whatever.bar
  },
  states: {
    whatever: {
      id: 'foo',
      states: {
        bar: {} // resolves to this state node
      }
    }
  }
});
```
