---
title: Select actor data
description: Subscribe to selected actor data in Svelte with useSelector.
---

`useSelector(actor, selector, compare?)` returns a readable Svelte store that updates only when the selected value changes.

```svelte
<script lang="ts">
  import { useActorRef, useSelector } from '@xstate/svelte';

  const actorRef = useActorRef(checkoutMachine);

  const total = useSelector(actorRef, (snapshot) => snapshot.context.total);
  const isPaying = useSelector(actorRef, (snapshot) => snapshot.matches('paying'));
</script>

<output>{$total}</output>
{#if $isPaying}<progress />{/if}
```

`$total` is Svelte's auto-subscription: the component subscribes when it renders and unsubscribes when it is destroyed.

## Arguments

| Argument | Description |
| --- | --- |
| `actor` | An actor reference. Required — unlike the Vue package, there is no support for `undefined` or a store of actors. |
| `selector` | `(snapshot) => value`. |
| `compare` | Optional equality function. Defaults to `(a, b) => a === b`. |

The actor only needs `getSnapshot()` and `subscribe(...)`, so any actor reference works, including [invoked or spawned children](../invoke.md).

## Change detection

The store is set only when `compare(previous, next)` returns `false`. A selector is therefore cheaper than reading the whole snapshot: a component that reads `$count` does not re-render when an unrelated part of context changes.

```svelte
<script lang="ts">
  const snapshot = useSelector(actorRef, (s) => s); // updates on every transition
  const count = useSelector(actorRef, (s) => s.context.count); // updates when count changes
</script>
```

Reference equality is the default, so a selector that builds a new object updates every time. Pass a comparison function in that case:

```ts
const summary = useSelector(
  actorRef,
  (snapshot) => ({
    step: snapshot.value,
    itemCount: snapshot.context.items.length
  }),
  (a, b) => a.step === b.step && a.itemCount === b.itemCount
);
```

Custom comparison also covers domain-level sameness, such as treating names that differ only in case as unchanged.

## Subscription timing

The store subscribes to the actor lazily, when it gets its first subscriber, and re-reads the current snapshot at that moment. A store created early and rendered later still shows the current value, not a stale one.

Dropping to zero subscribers unsubscribes from the actor but does not stop it. The actor's lifetime belongs to `useActorRef(...)`, not to the store.

## Selecting from child actors

```svelte
<script lang="ts">
  const { snapshot } = useActor(uploadMachine);
  const uploadRef = $snapshot.children.upload;
  const progress = useSelector(uploadRef, (s) => s.context.progress);
</script>
```

Children exist only while the state that invokes them is active, so read the child inside a block that renders only in that state, and pass it to a child component that calls `useSelector(...)` on it.

## Svelte 5

The package's API is store-based and unchanged under Svelte 5: `$snapshot` and `$count` auto-subscription work in runes mode too. There is no `$state`-based API. To derive from a selection in runes mode, wrap it:

```svelte
<script lang="ts">
  const total = useSelector(actorRef, (s) => s.context.total);
  const formatted = $derived(new Intl.NumberFormat().format($total));
</script>
```

> **Warning:** Auto-subscription only works for stores declared at the top level of a component's script. A store created inside a function or a nested block must be subscribed manually with `get(...)` or `store.subscribe(...)`.

## TypeScript

The snapshot type is inferred from the actor reference.

```ts
import type { SnapshotFrom } from 'xstate';

const selectTotal = (snapshot: SnapshotFrom<typeof checkoutMachine>) =>
  snapshot.context.total;

const total = useSelector(actorRef, selectTotal); // Readable<number>
```

## Selectors cheatsheet

```ts
useSelector(actorRef, (snapshot) => snapshot.context.count);
useSelector(actorRef, (snapshot) => snapshot.matches('loading'));
useSelector(actorRef, selector, (a, b) => a.id === b.id);
```
