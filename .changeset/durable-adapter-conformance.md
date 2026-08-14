---
'@xstate/durable-test': minor
---

Add a reusable Vitest conformance suite for durable execution adapters.

```ts
durableExecutionConformance({
  name: 'my durable host',
  createHarness,
  capabilities: new Set(['actions', 'timers', 'output'])
});
```
