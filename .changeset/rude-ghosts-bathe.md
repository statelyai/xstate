---
'@xstate/react': minor
---

- New `useMachine(...)` option: `filter(state, prevState)`, which allows you to filter the states that are provided:

```js
const [state, send] = useMachine(someMachine, {
  filter: (state, prevState) => {
    // don't rerender if only actions changed
    return (
      state.value !== prevState.value || state.context !== prevState.context
    );
  }
});
```

- New hook: `useMachineSelector(...)`, which enables you to apply a `selector` function to get part of (and/or transform) the machine's `state`:

```js
const [fullName, send] = useMachineSelector(
  userMachine,
  (state) => `${state.context.firstName} ${state.context.lastName}`
);
```
