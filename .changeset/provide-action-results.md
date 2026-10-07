---
'xstate': patch
---

`machine.provide({ actions })` now checks a replacement action's result, not only its parameters. When the declared action returns a result, such as a context patch that a transition returns, the replacement must return a compatible one. Before, a replacement that returned a mistyped patch, another value or nothing at all compiled, and the transition applied whatever it returned. An action declared to return nothing can still be replaced by one that returns any value, such as an Effect. A replacement is checked against the declared action, not against an earlier replacement.

```ts
const machine = setup({
  schemas: { events: { pick: z.object({ country: z.string() }) } },
  actions: {
    applyDefaults: (country: string) => ({
      context: { currency: country === 'FR' ? 'EUR' : 'USD' }
    })
  }
}).createMachine({
  context: { currency: 'USD' },
  on: { pick: ({ actions, event }) => actions.applyDefaults(event.country) }
});

machine.provide({
  // now a type error: `applyDefaults` returns a context patch
  actions: { applyDefaults: () => {} }
});
```
