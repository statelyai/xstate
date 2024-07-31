---
'xstate': patch
---

The `CreateActorOptionsArgs<TLogic>` type has been introduced to make it easier to create custom actor creation functions. This is necessary since actor logic may take input:

```ts
function myCreateActorFunction<TLogic extends AnyActorLogic>(
  logic: TLogic,
  [...options]: CreateActorOptionsArgs<TLogic>
): ActorRefFrom<TLogic> {
  // ...
  const actorRef = createActor(logic, options);

  return actorRef;
}
```
