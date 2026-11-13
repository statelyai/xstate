---
"xstate": patch
---

Evaluate invoke input after applying the context patch returned by the invoking state's entry function. Invoke references remain available during entry for sends, listeners, and subscriptions.

```ts
loading: {
  entry: () => ({ context: { consent: 'granted' } }),
  invoke: {
    src: loadUser,
    input: ({ context }) => ({ consent: context.consent }) // 'granted'
  }
}
```
