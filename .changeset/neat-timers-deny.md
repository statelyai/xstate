---
'xstate': minor
---

Add optional type parameter to narrow type returned by `EventFrom`. You can use it like this:

```ts
type UpdateNameEvent = EventFrom<typeof userModel>;
```
