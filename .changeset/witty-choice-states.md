---
'xstate': minor
---

Add `choice` states — a state that immediately routes to a target via a resolver function, returning the first matching transition config.

```ts
const machine = createMachine({
  context: { userStatus: 'vip' },
  initial: 'routing',
  states: {
    routing: {
      type: 'choice',
      choice: ({ context }) => {
        if (context.userStatus === 'vip') return { target: 'vipFlow' };
        return { target: 'standardFlow' };
      }
    },
    vipFlow: {},
    standardFlow: {}
  }
});
```

A choice state must declare a `choice` function and must resolve to a target, and may not declare `entry`/`exit`/`on`/`after`/`invoke` — these throw at construction.
