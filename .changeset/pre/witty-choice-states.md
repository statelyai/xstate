---
'xstate': minor
---

Add `choice` states: a state that immediately routes to a target via a resolver function or serializable branch array.

```ts
const machine = createMachine({
  context: { userStatus: 'vip' },
  initial: 'routing',
  states: {
    routing: {
      type: 'choice',
      choice: [
        {
          when: { '@expr': 'context.userStatus === "vip"' },
          target: 'vipFlow'
        },
        { target: 'standardFlow' }
      ]
    },
    vipFlow: {},
    standardFlow: {}
  }
});
```

A choice state must declare `choice` and must resolve to a target. Choice branches may update context or provide target input, but may not declare actions or dynamic `to` functions.
