---
'xstate': patch
---

Unknown transition targets are now type errors in `setup().createMachine(...)`, not only in `createMachine(...)`. Targets returned from transition functions are also checked:

```ts
setup({}).createMachine({
  initial: 'a',
  states: {
    a: {
      on: {
        // Type error: 'bb' is not a state
        GO: () => ({ target: 'bb' })
      }
    },
    b: {}
  }
});
```

Dynamic (non-literal) string targets are still accepted.
