---
'xstate': minor
---

Action parameters can now be directly accessed from the 2nd argument of the action implementation:

```ts
const machine = createMachine(
  {
    // ...
    entry: {
      type: 'greet',
      params: { message: 'hello' }
    }
  },
  {
    actions: {
      greet: (_, params) => {
        params.message; // 'hello'
      }
    }
  }
);
```
