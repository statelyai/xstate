---
'xstate': patch
---

In `setup()`, an invoke's `onSnapshot` callback now types `event.snapshot` from the registered actor when `src` is its name:

```ts
const watchItems = createObservableLogic<string[], { topic: string }>({
  /* ... */
});

setup({ actors: { watchItems } }).createMachine({
  invoke: {
    src: 'watchItems',
    input: { topic: 'news' },
    onSnapshot: ({ event }) => {
      event.snapshot; // ObservableSnapshot<string[], { topic: string }>
    }
  }
});
```

Previously `event.snapshot` was `any`, while `onDone` and `onError` were already typed from the registered actor.
