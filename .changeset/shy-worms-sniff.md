---
'xstate': minor
---

Add partial descriptor support to `assertEvent(…)`

```ts
// Matches any event with a type that starts with `FEEDBACK.`
assertEvent(event, 'FEEDBACK.*');
```
