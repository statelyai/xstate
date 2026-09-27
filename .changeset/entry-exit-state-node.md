---
'xstate': minor
---

Entry and exit functions now receive `stateNode`, the state node being entered or exited.

```ts
createMachine({
  initial: 'a',
  states: {
    a: {
      entry: ({ stateNode }, enq) => {
        enq(() => console.log('Entered', stateNode.id));
      }
    }
  }
});
```
