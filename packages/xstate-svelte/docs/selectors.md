---
title: Select actor data
description: Subscribe to selected actor data in Svelte.
---

`useSelector(...)` returns a readable Svelte store.

```svelte
<script lang="ts">
  const actorRef = useActorRef(machine);
  const count = useSelector(actorRef, (snapshot) => snapshot.context.count);
</script>

<output>{$count}</output>
```

## TypeScript

The selector receives the snapshot type from the actor reference.

## Selectors cheatsheet

```ts
useSelector(actorRef, selector);
useSelector(actorRef, selector, compare);
```
