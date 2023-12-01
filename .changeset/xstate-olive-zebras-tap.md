---
'xstate': major
---

You can now import the following from `xstate`:

```js
import {
  // actions
  // sendTo (removed)
  pure,

  // interpret helpers
  waitFor,

  // actor functions
  fromPromise,
  fromObservable,
  fromCallback,
  fromEventObservable,
  fromTransition,

  // guard functions
  stateIn,
  not,
  and,
  or
}
```

The `send` action was removed from exports; use `sendTo(...)` or `raise(...)` instead.
