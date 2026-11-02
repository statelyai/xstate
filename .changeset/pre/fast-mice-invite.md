---
"@xstate/effect": patch
---

Infer declared Effect action arguments from setup schemas, including decoded context types, public and internal events, and merged extension schemas. Actions without context schemas receive `unknown` context values instead of implicit `any`.

Declare custom action arguments with `schemas.actions.<name>.params`. This schema describes the whole first argument. Include the owning `self` when enqueueing the action:

```ts
const machine = setupEffect({
  schemas: {
    actions: {
      audit: { params: Schema.Struct({ message: Schema.String }) }
    }
  },
  actions: {
    audit: ({ message }) => Effect.log(message)
  }
}).createMachine({
  on: {
    SAVE: (args, enq) =>
      enq(args.actions.audit, { self: args.self, message: 'saved' })
  }
});
```
