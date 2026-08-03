---
title: Select actor data
description: Track selected actor data in Vue.
---

`useSelector(...)` returns a Vue ref and updates it when the selected value changes.

```ts
const actorRef = useActorRef(machine);
const count = useSelector(actorRef, (snapshot) => snapshot.context.count);
```

## TypeScript

The selector receives the snapshot type from the actor reference.

## Selectors cheatsheet

```ts
useSelector(actorRef, selector);
useSelector(actorRef, selector, compare);
```
