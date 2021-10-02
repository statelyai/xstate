---
'@xstate/react': patch
---

author: @farskid
author: @Andarist

Fixed a regression with a development-only warning not being shown when a machine reference is updated during the hook lifecycle. This usually happens when machine options are dependent on external values and they're passed via `withConfig`.

```js
const machine = createMachine({
  initial: 'foo',
  context: { id: 1 },
  states: {
    foo: {
      on: {
        CHECK: {
          target: 'bar',
          cond: 'hasOverflown'
        }
      }
    },
    bar: {}
  }
});

const [id, setId] = useState(1);
const [current, send] = useMachine(
  machine.withConfig({
    guards: {
      hasOverflown: () => id > 1 // id is a reference to an outside value
    }
  })
);

// later when id updates
setId(2);
// Now the reference passed to `useMachine` (the result of `machine.withConfig`) is updated but the interpreted machine stays the same. So the guard is still the previous one that got passed to the `useMachine` initially, and it closes over the stale `id`.
```
