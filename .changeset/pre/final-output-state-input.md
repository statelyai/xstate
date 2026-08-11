---
'xstate': patch
---

Final state `output` mappers now receive the state's `input`.

```ts
LOAD: ({ event }) => ({
  target: 'done',
  input: { userId: event.userId }
})

// ...

done: {
  type: 'final',
  output: ({ input }) => ({
    userId: input.userId
  })
}
```

Previously, `input` was unavailable in final `output` mappers. Now it is forwarded the same way as for `entry` / `exit` actions.
