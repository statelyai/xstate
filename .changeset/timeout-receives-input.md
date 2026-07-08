---
'xstate': patch
---

State input is now available in `on`, `after`, `timeout`, and `onTimeout` handlers (previously only `entry`/`exit` received it).

```ts
const machine = setup({
  states: {
    active: {
      schemas: { input: z.object({ duration: z.number() }) }
    }
  }
}).createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        activate: ({ event }) => ({
          target: 'active',
          input: { duration: event.duration }
        })
      }
    },
    active: {
      timeout: ({ input }) => input.duration,
      onTimeout: ({ input }) => ({ target: 'idle' }),
      after: {
        1000: ({ input }) => ({ target: 'idle' })
      },
      on: {
        ping: ({ input }, enq) => {}
      }
    }
  }
});
```
