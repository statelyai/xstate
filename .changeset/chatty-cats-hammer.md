---
'xstate': patch
---

Generated IDs for invocations that do not provide an `id` are now based on the state ID to avoid collisions:

```js
createMachine({
  id: 'test',
  initial: 'p',
  states: {
    p: {
      type: 'parallel',
      states: {
        // Before this change, both invoke IDs would be 'someSource',
        // which is incorrect.
        a: {
          invoke: {
            src: 'someSource'
            // generated invoke ID: 'test.p.a:invocation[0]'
          }
        },
        b: {
          invoke: {
            src: 'someSource'
            // generated invoke ID: 'test.p.b:invocation[0]'
          }
        }
      }
    }
  }
});
```
