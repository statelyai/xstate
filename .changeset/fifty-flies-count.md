---
'@xstate/react': major
---

The Context object returned from `createActorContext(...)` now provides a `.useSnapshot()` hook, which replaces `useActor()`:

```ts
// instead of this:
// const [state, send] = SomeContext.useActor();
const [state, send] = SomeContext.useSnapshot();
```
