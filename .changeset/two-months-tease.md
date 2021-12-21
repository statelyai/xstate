---
'xstate': minor
---

Action creators now have a reference to `self`, which is the `ActorRef` that executed the action:

```js
const machine = createMachine({
  entry: (context, event, { self }) => {
    // `self` is actor ref of the interpreted machine
    // `self.send()` and `self.getSnapshot()` methods are available.
  }
  // ...
});
```
