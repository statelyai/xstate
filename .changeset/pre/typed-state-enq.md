---
'xstate': patch
---

State transition functions now type `enq` with the machine's events and emitted events.

```ts
setup({
  schemas: {
    events: {
      go: types<{}>()
    }
  }
}).createMachine({
  states: {
    active: {
      on: {
        go: (_args, enq) => {
          enq.raise({ type: 'go' });
        }
      }
    }
  }
});
```
