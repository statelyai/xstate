---
"xstate": patch
---

Include internal runtime events in general machine callback types. Entry, exit, eventless and wildcard transitions, choice functions, invoke resolvers, delays, timeouts, initial input mappers, and final-state output mappers now require narrowing before reading public event payloads:

```ts
entry: ({ event }) => {
  if (event.type === 'PING') {
    console.log(event.n);
  }
}
```

Public events accepted by `actor.send(...)` are unchanged. Specific transitions, including `onDone` and `onError`, retain their payload types.
