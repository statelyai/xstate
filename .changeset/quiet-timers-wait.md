---
"xstate": patch
---

Resolve `after` delays and state timeout functions with context updated by the same state's `entry` function.

```ts
waiting: {
  entry: () => ({ context: { ms: 300 } }),
  after: { d: { target: 'done' } }
}
// With delays: { d: ({ context }) => context.ms }, waits 300ms.
```
