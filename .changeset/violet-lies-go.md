---
'xstate': patch
---

Require payload samples for known event types with required fields in `getShortestPaths`, `getSimplePaths`, and `getAdjacencyMap`. Use an `events` map to explore multiple payloads while retaining default payload-free events, invoke completions, errors, and delays:

```ts
getShortestPaths(machine, {
  events: {
    'item.add': [{ item: { qty: 1 } }, { item: { qty: 0 } }]
  }
});
```

Each map entry also accepts a snapshot callback returning nonempty payload cases. Event arrays and callbacks returning events still replace defaults, but their types must cover every required payload event. Fixed-sequence replay with `getPathsFromEvents` requires only the supplied events. Coverage remains sample-based.
