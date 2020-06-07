---
'xstate': minor
---

The resolved value of the `invoke.data` property is now available in the "invoke meta" object, which is passed as the 3rd argument to the service creator in `options.services`. This will work for all types of invoked services now, including promises, observables, and callbacks.

```js
const machine = createMachine({
  initial: 'pending',
  context: {
    id: 42
  },
  states: {
    pending: {
      invoke: {
        src: 'fetchUser',
        data: {
          userId: (context) => context.id
        },
        onDone: 'success'
      }
    },
    success: {
      type: 'final'
    }
  }
},
{
  services: {
    fetchUser: (ctx, _, { data }) => {
      return fetch(`some/api/user/${data.userId}`)
        .then(response => response.json());
    }
  }
}
```
