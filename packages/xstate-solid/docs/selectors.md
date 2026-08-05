---
title: Select actor data
description: Read actor data through a Solid accessor.
---

Use `fromActorRef(...)` to create an accessor for an actor snapshot.

```tsx
const actorRef = useActorRef(machine);
const snapshot = fromActorRef(actorRef);

return <output>{snapshot().context.count}</output>;
```

Derive narrower values with Solid's `createMemo(...)` when needed.

Prefer small selected values such as a cart total, user name or `snapshot.matches('loading')`. This keeps dependencies clear and avoids recalculating unrelated UI.

## TypeScript

The accessor snapshot type comes from the actor reference.

## Selectors cheatsheet

```ts
const snapshot = fromActorRef(actorRef);
const selected = createMemo(() => select(snapshot()));
```
