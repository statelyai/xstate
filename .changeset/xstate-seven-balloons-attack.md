---
'xstate': major
---

Actor types can now be specified in the `.types` property of `createMachine`:

```ts
const fetcher = fromPromise(() => fetchUser());

const machine = createMachine({
  types: {} as {
    actors: {
      src: 'fetchData'; // src name (inline behaviors ideally inferred)
      id: 'fetch1' | 'fetch2'; // possible ids (optional)
      logic: typeof fetcher;
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
