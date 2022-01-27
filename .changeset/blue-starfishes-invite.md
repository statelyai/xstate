---
'xstate': minor
---

Using `config.schema` becomes the preferred way of "declaring" TypeScript generics with this release:

```js
createMachine({
    schema: {
        context: {} as { count: number },
        events: {} as { type: 'INC' } | { type: 'DEC' }
    }
})
```

This allows us to leverage the inference algorithm better and unlocks some exciting possibilities for using XState in a more type-strict manner.
