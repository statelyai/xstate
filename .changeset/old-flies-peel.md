---
'xstate': minor
'@xstate/react': minor
---

Introduced 'input' - a way of specifying dependencies to the machine which cannot be assigned to. Input can be specified like so:

```ts
const machine = createMachine(
  {
    entry: (context, event, meta) => {
      console.log(meta.state.input.lyric); // 'In west philadelphia, born and raised'
    }
  },
  {
    input: {
      lyric: 'In west philadelphia, born and raised'
    }
  }
);
```

### Re-specifying initial inputs

You can re-specify them using `.withConfig`:

```ts
const machineWithDifferentInput = machine.withConfig({
  input: {
    lyric: 'In the playground, where I spend most of my days'
  }
});
```

### Updating inputs

You can update inputs on a running service using the `service.input()` method:

```ts
const service = interpret(machine).start();

service.input({
  lyric: 'Chilling out, maxing, relaxing all cool'
});
```

### State

Input is available on the `state` property:

```ts
console.log(service.state.input.lyric); // 'Chilling out, maxing, relaxing all cool'
```

### Listening for new inputs

You can listen for updates to the inputs on the `xstate.input` event:

```ts
const machine = createMachine({
  on: {
    'xstate.input': {
      actions: (context, event, meta) => {
        console.log(meta.state.input);
      }
    }
  }
});
```

> Inputs always resolve _before_ any actions relating to the `xstate.input` transitions are run. This means that `meta.state.input` will always be up to date.

## Type safety

### createModel

Inputs can be made type-safe using `createModel`:

```ts
const model = createModel({}).withInput(
  {} as {
    lyric: string;
  }
);

const machine = model.createMachine(
  {
    entry: [
      (context, event, meta) => {
        // Input is type-safe
        console.log(meta.state.input.lyric);
      }
    ]
  },
  {
    input: {
      lyric: 'And all shooting some b-ball outside of the school'
    }
  }
);
```

## React

### Use with other hooks

Input can now be passed into `useMachine` and `useInterpret`:

```ts
const Component = (props) => {
  const [result] = useQuery();

  const [state, send] = useMachine(machine, {
    input: {
      // props.id and result.data will be kept up to date
      // in the machine above
      id: props.id,
      data: result.data
    }
  });
};
```

Each render, the input will be kept up to date inside the machine, allowing for easy integration with other hooks and props.
