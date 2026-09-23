---
'xstate': patch
'@xstate/effect': patch
---

The dead-letter inspection event type is renamed from `@xstate.deadletter` to `@xstate.deadLetter`, matching the `@xstate.deadLetter` effect.

```ts
createActor(machine, {
  inspect: (event) => {
    if (event.type === '@xstate.deadLetter') {
      console.log(event.reason);
    }
  }
});
```
