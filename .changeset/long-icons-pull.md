---
'@xstate/react': patch
---

Correct reference to the machine in `useInterpret` hook.
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
// Now the reference to `machine.withConfig` from above is updated but in the guard, the id value is still stale (id=1).
```
