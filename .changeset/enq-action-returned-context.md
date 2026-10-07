---
'xstate': patch
---

Development builds now warn when a function passed to `enq(...)` returns `{ context }` or `{ children }`. Enqueued functions run as effects after the transition, so that value has always been ignored, and nothing said so. To update context from a named action, call it directly in the transition, entry or exit function and return its result:

```ts
const formSetup = setup({
  schemas: { events: { pick: z.object({ country: z.string() }) } },
  actions: {
    applyDefaults: (country: string) => ({
      context: { currency: country === 'FR' ? 'EUR' : 'USD' }
    })
  }
});

// Applied: the transition function returns the patch
pick: ({ actions, event }) => actions.applyDefaults(event.country);

// Ignored, and now reported in development
pick: ({ actions, event }, enq) => {
  enq(actions.applyDefaults, event.country);
};
```
