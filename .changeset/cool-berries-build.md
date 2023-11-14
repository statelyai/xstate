---
'xstate': major
---

Removed the ability to configure `input` within the implementations object. You no longer can do this:

```ts
createMachine(
  {
    invoke: {
      src: 'child'
    }
  },
  {
    actors: {
      child: {
        src: childMachine,
        input: 'foo'
      }
    }
  }
);
```

The `input` can only be provided within the config of the machine.
