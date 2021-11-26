---
'xstate': minor
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

You can update inputs on a running service using the `service.input()` method:

```ts
const service = interpret(machine).start();

service.input({
  lyric: 'Chilling out, maxing, relaxing all cool'
});
```

Learn more about this by reading our updated docs.
