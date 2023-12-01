---
'xstate': minor
---

The `onSnapshot: { ... }` transition object is now supported for invoked machines, observables, promises, and transition functions:

```ts
const machine = createMachine({
  // ...
  invoke: [
    {
      src: createMachine({ ... }),
      onSnapshot: {
        actions: (context, event) => {
          event.snapshot; // machine state
        }
      }
    },
    {
      src: fromObservable(() => ...),
      onSnapshot: {
        actions: (context, event) => {
          event.snapshot; // observable value
        }
      }
    },
    {
      src: fromTransition((state, event) => { ... }, /* ... */),
      onSnapshot: {
        actions: (context, event) => {
          event.snapshot; // transition function return value
        }
      }
    }
  ]
});
```
