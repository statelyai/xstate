---
"xstate": minor
---

`createAsyncLogic` accepts `schemas.error`. It types the actor's `error` snapshot field and `event.error` in the invoking machine's `onError`. Without it, the error stays `unknown`, so reading properties from it is a type error.

```ts
const fetchUser = createAsyncLogic({
  schemas: {
    output: z.object({ name: z.string() }),
    error: z.object({ code: z.string() }),
  },
  run: async () => ({ name: "David" }),
});

setup({ actors: { fetchUser } }).createMachine({
  invoke: {
    src: "fetchUser",
    onError: ({ event }) => {
      event.error.code; // string
    },
  },
});
```

Without `schemas.error`, narrow `event.error` before reading from it.

With a `timeout`, the error type also includes `TimeoutError`, so narrow before reading schema fields:

```ts
onError: ({ event }) => {
  if (event.error instanceof TimeoutError) return;
  event.error.code; // string
};
```
