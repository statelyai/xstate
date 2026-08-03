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

## TypeScript

The selector receives the snapshot type from the actor reference.

## Selectors cheatsheet

```tsx
useSelector(actorRef, selector);
useSelector(actorRef, selector, compare);
```
