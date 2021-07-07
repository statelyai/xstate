---
'xstate': patch
---

Existing actors can now be identified in `spawn(...)` calls by providing an `id`. This allows them to be referenced by string:

```ts
const machine = createMachine({
  context: () => ({
    someRef: spawn(someExistingRef, 'something')
  }),
  on: {
    SOME_EVENT: {
      actions: send('AN_EVENT', { to: 'something' })
    }
  }
});
```
