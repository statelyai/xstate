---
'xstate': major
---

Actor types can now be specified in the `.types` property of `createMachine`:

```ts
const machine = createMachine({
  types: {} as {
    actors: {
      src: 'fetchData'; // src name (inline behaviors ideally inferred)
      id: 'fetch1' | 'fetch2'; // possible ids
      input: { foo: string };
      output: { result: string };
    };
  },
  invoke: {
    src: 'fetchData', // strongly typed
    id: 'fetch2', // strongly typed
    onDone: {
      actions: ({ event }) => {
        event.output; // strongly typed as { result: string }
      }
    },
    input: { foo: 'hello' } // strongly typed
  }
});
```

Only the `src` (string) is required. The other properties are optional.

```ts
interface ActorImpl {
  src: string;
  events?: EventObject;
  snapshot?: any;
  input?: any;
  output?: any;
  id?: string;
}
```
