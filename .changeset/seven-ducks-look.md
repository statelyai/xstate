---
'xstate': patch
---

pr: #3545
author: @with-heart

Updated `pure` action types to allow action `type` strings to be returned in the array.

```ts
const machine = createMachine(
  {
    entry: ['doStuff']
  },
  {
    actions: {
      doStuff: pure(() => ['someAction']),
      someAction: () => console.log('executed by doStuff')
    }
  }
);
```

Returning action `type` strings were already handled by `xstate` and the types now correctly reflect that.
