---
'xstate': minor
---

An array of guards can now be specified in a transition's `cond: ...` property. All guards in the array must pass ("and" behavior) for the transition to be taken.

```js
// ...
on: {
  WITHDRAW: {
    cond: ['isLoggedIn', 'hasMoney'],
    target: 'withdrawn'
  }
}
// ...
```
