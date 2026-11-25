---
"@xstate/test": minor
---

Use `testPaths(machine, { cases })` to exercise exact payloads for enabled
events, including events that lead to the same state. Set `checkUnhandled`
per event to verify that the implementation ignores it where the machine
has no enabled transition.

```ts
await testPaths(machine, {
  cases: { APPROVE: [{ script: 0 }] },
  checkUnhandled: { APPROVE: true },
  sut
});
```

Use `createTestModel()` to test and replay a standalone specification written
with TypeScript functions.
