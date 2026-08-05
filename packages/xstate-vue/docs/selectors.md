---
title: Select actor data
description: Track selected actor data in Vue.
---

`useSelector(...)` returns a Vue ref and updates it when the selected value changes.

```ts
const actorRef = useActorRef(machine);
const count = useSelector(actorRef, (snapshot) => snapshot.context.count);
```

Prefer small selected values such as a count, name or `snapshot.matches('loading')`. Selecting the whole context updates more consumers. Pass a comparison function when a selector returns an object.

## TypeScript

The selector receives the snapshot type from the actor reference.

## Selectors cheatsheet

```ts
useSelector(actorRef, selector);
useSelector(actorRef, selector, compare);
```
