---
'@xstate/react': minor
---

Input can now be passed into `useMachine` and `useInterpret`:

```ts
const machine = createMachine({
  entry: (context, event, meta) => {
    console.log(meta.state.input.id);
  }
});

const Component = (props) => {
  const [state, send] = useMachine(machine, {
    input: {
      // props.id will be kept up to date
      id: props.id
    }
  });
};
```

Each render, the input will be kept up to date inside the machine, allowing for easy integration with other hooks and props.

Learn more about input by reading our updated docs.
