---
'xstate': minor
---

Add `machineVersions().adaptEvents()` for adapting complete event histories
between machine versions. Exact retained-version adapters infer source and
target event types, while an async `'*'` adapter can handle unknown histories.

```ts
const events = await versions.adaptEvents(storedEvents, {
  from: { id: 'checkout', version: '1' },
  to: '2',
  adapters: {
    '1': (events) => events.map(toV2Event)
  }
});
```
