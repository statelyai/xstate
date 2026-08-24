---
'xstate': patch
---

Object transition configs now support dynamic context patches with a `context` mapper.

```ts
onDone: {
  target: 'done',
  context: ({ context, output }) => ({
    answer: output,
    memory: [...context.memory, output]
  })
}
```
