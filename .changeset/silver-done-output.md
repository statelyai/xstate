---
'xstate': patch
---

Done transitions now receive `output` directly in callback arguments.

```ts
invoke: {
  src: fetchUser,
  onDone: ({ output }) => {
    output.name;
  }
}
```

The direct `output` value is only provided for XState done events, such as
`xstate.done.actor.*` and `xstate.done.state.*`.
