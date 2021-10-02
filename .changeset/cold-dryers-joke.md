---
'xstate': minor
---

The `description` property is a new top-level property for state nodes and transitions, that lets you provide text descriptions:

```ts
const machine = createMachine({
  // ...
  states: {
    active: {
      // ...
      description: 'The task is in progress',
      on: {
        DEACTIVATE: {
          // ...
          description: 'Deactivates the task'
        }
      }
    }
  }
});
```

Future Stately tooling will use the `description` to render automatically generated documentation, type hints, and enhancements to visual tools.
