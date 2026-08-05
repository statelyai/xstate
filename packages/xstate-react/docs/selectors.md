---
title: Select actor data
description: Render only when selected actor data changes.
---

Use `useSelector(...)` with an actor reference.

```tsx
const actorRef = useActorRef(machine);
const count = useSelector(actorRef, (snapshot) => snapshot.context.count);
```

The component renders again when the selected value changes. Pass a comparison function as the third argument for values that need custom equality.

Prefer small selected values such as a count, name or `snapshot.matches('loading')`. Selecting the whole context causes more renders.

```tsx
const isLoading = useSelector(actorRef, (snapshot) =>
  snapshot.matches('loading')
);
```

Use `shallowEqual` when a selector returns a small object.

## TypeScript

The selector receives the snapshot type from the actor reference.

## Selectors cheatsheet

```tsx
useSelector(actorRef, selector);
useSelector(actorRef, selector, compare);
useSelector(actorRef, selector, shallowEqual);
```
