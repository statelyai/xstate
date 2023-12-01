---
'xstate': minor
---

Guard parameters can now be directly accessed from the 2nd argument of the guard implementation:

```ts
const machine = createMachine(
  {
    // ...
    on: {
      EVENT: {
        guard: {
          type: 'isGreaterThan',
          params: { value: 10 }
        }
      }
    }
  },
  {
    guards: {
      isGreaterThan: (_, params) => {
        params.value; // 10
      }
    }
  }
);
```
