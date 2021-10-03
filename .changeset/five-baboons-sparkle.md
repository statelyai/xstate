---
'xstate': patch
---

The `.state` and `._event` values have been added to the meta-object provided as the 3rd argument to service creators:

```ts
const machine = createMachine({
  initial: 'someState',
  states: {
    someState: {
      invoke: {
        src: (_ctx, _e, { state, _event }) => {
          // state and _event provided, as expected
        }
      }
    }
  }
});
```
