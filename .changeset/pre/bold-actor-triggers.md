---
'xstate': minor
---

Add `actor.trigger` — a typed event-sender proxy. `actor.trigger.EVENT(payload)` is shorthand for `actor.send({ type: 'EVENT', ...payload })`:

```ts
actor.trigger.NEXT();
actor.trigger.INC({ by: 5 });
```
