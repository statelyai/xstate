---
'@xstate/react': patch
'@xstate/vue': patch
'@xstate/svelte': patch
---

author: @farskid
author: @Andarist

Fixed an issue with actors not being spawned correctly by `useMachine` and `useInterpret` when they were defined a lazily evaluated context, like for example here:

```js
createMachine({
  // lazy context
  context: () => ({
    ref: spawn(() => {})
  })
});
```
