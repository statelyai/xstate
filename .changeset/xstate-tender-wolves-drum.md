---
'xstate': minor
---

You can now use the `setup({ ... }).createMachine({ ... })` function to setup implementations for `actors`, `actions`, `guards`, and `delays` that will be used in the created machine:

```ts
import { setup, createMachine } from 'xstate';

const fetchUser = fromPromise(async ({ input }) => {
  const response = await fetch(`/user/${input.id}`);
  const user = await response.json();
  return user;
});

const machine = setup({
  actors: {
    fetchUser
  },
  actions: {
    clearUser: assign({ user: undefined })
  },
  guards: {
    isUserAdmin: (_, params) => params.user.role === 'admin'
  }
}).createMachine({
  // ...
  invoke: {
    // Strongly typed!
    src: 'fetchUser',
    input: ({ context }) => ({ id: context.userId }),
    onDone: {
      guard: {
        type: 'isUserAdmin',
        params: ({ context }) => ({ user: context.user })
      },
      target: 'success',
      actions: assign({ user: ({ event }) => event.output })
    },
    onError: {
      target: 'failure',
      actions: 'clearUser'
    }
  }
});
```
