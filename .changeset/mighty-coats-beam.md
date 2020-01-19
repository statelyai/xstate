---
'@xstate/fsm': minor
---

Added a second, optional, `options` parameter to the `createMachine`. Currently only `actions` map can be put there - similarly how this can be done for `xstate` itself:

<details>
<summary>Example</summary>

```js
const machine = createMachine({
  initial: 'idle'
  states: {
    idle: {
      on: {
        LOAD: {
          target: 'loading',
          actions: 'fetchData'
        }
      }
    },
    loading: {
      // ...
    }
  }
}, {
  actions: {
    fetchData: () => /* ... */
  }
})
```

</details>
