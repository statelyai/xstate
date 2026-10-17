---
'xstate': major
---

`ActorRefFrom<T>` accepts actor logic only, and `ActorRefFromLogic<T>` is removed. Replace `ActorRefFromLogic<T>` with `ActorRefFrom<T>`. Pass the logic type instead of a promise, an actor ref, or a function returning logic:

```ts
// Before
type Ref = ActorRefFromLogic<typeof machine>;
type AsyncRef = ActorRefFrom<Promise<User>>;

// After
type Ref = ActorRefFrom<typeof machine>;
type AsyncRef = ActorRefFrom<typeof loadUser>;
```

`ActorRefFrom<typeof machine>` refs return the fully typed machine snapshot from `getSnapshot()`, including `context`, `value` and `matches('#id')`.
