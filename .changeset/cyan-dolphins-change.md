---
'xstate': minor
---

Tags can now be added to state node configs under the `.tags` property:

```js
const machine = createMachine({
  initial: 'green',
  states: {
    green: {
      tags: 'go' // single tag
    },
    yellow: {
      tags: 'go'
    },
    red: {
      tags: ['stop', 'other'] // multiple tags
    }
  }
});
```

You can query whether a state has a tag via `state.hasTag(tag)`:

```js
const canGo = state.hasTag('go');
// => `true` if in 'green' or 'red' state
```
