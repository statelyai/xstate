---
'xstate': patch
---

By default, spawned machines will now have `execute: true` to prevent edge-cases where the parent service is configured with `execute: false` and this is (erroneously) set for invoked child services.

If you were relying on this unintentional behavior to prevent invoked machines from executing their actions, the `execute: false` option can be set in the `invoke` config:

```js
// ...
invoke: {
  src: someMachine,
  execute: false
}
// ...
```
