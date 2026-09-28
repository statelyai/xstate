---
"xstate": patch
---

Resolve `after` delays and state timeout functions with context updated by the same state's `entry` function.

State timers are scheduled after the entry function's queued actions. Entry cancellation runs before scheduling; cancellation from a later event handler still cancels an active timer.

```ts
waiting: {
  entry: () => ({ context: { ms: 300 } }),
  after: { d: { target: 'done' } }
}
// With delays: { d: ({ context }) => context.ms }, waits 300ms.
```
