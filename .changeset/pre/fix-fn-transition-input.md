---
'xstate': patch
---

Fix function-syntax transitions not passing `input` to target state entry actions.

```ts
on: {
  FETCH: ({ context, event }) => ({
    target: 'fetching',
    input: { url: event.url, token: context.authToken }
  });
}
```

Previously, `input` returned from function-syntax transitions was silently ignored. Now it is correctly forwarded to the target state's `entry` action.
