---
'@xstate/react': minor
---

You can conveniently create a subscription to the interpreter inside `useInterpret` and `useMachine` hooks.

```js
const machine = createMachine({
  initial: 'active',
  states: {
    inactive: {
      on: {
        ACTIVATE: 'active'
      }
    },
    active: {
      on: {
        DEACTIVATE: 'inactive'
      }
    }
  }
});
```

**Before**:

```jsx
const [, , actor] = useMachine(machine);
// Or
const [, , actor] = useInterpret(machine);

React.useEffect(() => {
  return actor.subscribe((state) => {
    // do something with the state object
  }).unsubscribe;
}, []);
```

**After**:

```jsx
const [, , actor] = useMachine(machine, {
  subscribe: (state) => {
    // do something with the state object
  }
});
// Or
const [, , actor] = useInterpret(machine, {
  subscribe: (state) => {
    // do something with the state object
  }
});
```
