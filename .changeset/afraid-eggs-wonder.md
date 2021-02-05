---
'@xstate/fsm': minor
---

Transitions with `undefined` targets will no longer exit and re-enter the state, which means that `exit` and `entry` actions will not be executed:

```js
// ...
someState: {
  entry: [/* ... */],
  exit: [/* ... */],
  on: {
    SOME_EVENT: {
      // undefined target - will not exit/re-enter
      actions: [/* ... */]
    }
  }
}
// ...
```
