---
"xstate": minor
"@xstate/react": minor
---

Added the ability to tighten TS declarations of machine with generated metadata. This opens several exciting doors to being able to use typegen seamlessly with XState to provide an amazing typing experience.

The basics work like this:

```ts
const model = createModel({}, {
  events: {
    FOO: () => ({}),
    BAR: () => ({}),
  }
});

interface Meta {
  '@@xstate/typegen': true;
  eventsCausingServices: {
    myService: 'FOO';
  };
}

const machine = model.createMachine({
  types: {} as typeof Meta,
  invoke: {
    src: 'myService'
  }
}, {
  services: {
    myService: async (context, event) => {
      // event is typed to be { type: 'FOO' }
    }
  }
})
```

This works for guards, actions, delays - and also influences `state.matches` and `state.hasTag`.
