---
'xstate': patch
---

Fixed `invoke.onDone` transition argument inference when actor logic is passed directly as `src` in a machine with two or more differently-typed registered actors. Previously, the transition function's arguments collapsed to `any` (`event.output` was unusable without annotations); now `event.output` is inferred from the invoked actor's output type.

```ts
const fetchUser = createAsyncLogic({ run: async () => ({ name: 'David' }) });
const fetchCount = createAsyncLogic({ run: async () => 42 });

setup({
  actors: { fetchUser, fetchCount }
}).createMachine({
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: fetchUser,
        onDone: ({ event }) => {
          event.output.name; // string
          return { target: 'done' };
        }
      }
    },
    done: {}
  }
});
```

Note: when actors are registered, invoking *unregistered* inline logic now only supports the object/target forms of `onDone` (not the transition function form). Register the actor to get fully-typed function-form transitions.
