---
'@xstate/test': minor
---

Add support for tags in testing machines

Tags can be re-used across multiple state nodes, which allows for abstracting out repeated bits of testing functionality.

You can use tags in your tests by adding a `tags` property to testing statechart states,

```js
createTestMachine({
  initial: 'a',
  states: {
    a: {
      // The tagTest function will be run whenever a path.test() visits this state
      tags: 'tagTest',

      on: {
        EVENT: 'b'
      }
    }

    // ...
  }
});
```

and then defining the functions to run for those tags by passing them to `path.test()`

```js
path.test({
  states: {
    async a() {
      /* ... */
    }
  },

  events: {
    async EVENT() {
      /* ... */
    }
  },

  tags: {
    async tagTest() {
      /* ... */
    }
  }
});
```
