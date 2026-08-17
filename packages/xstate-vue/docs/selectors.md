---
title: Select actor data
description: Track selected actor data in Vue with useSelector.
---

`useSelector(actor, selector, compare?)` returns a `Ref` that updates only when the selected value changes.

```vue
<script setup lang="ts">
import { useActorRef, useSelector } from '@xstate/vue';

const actorRef = useActorRef(checkoutMachine);
const total = useSelector(actorRef, (snapshot) => snapshot.context.total);
const isPaying = useSelector(actorRef, (snapshot) => snapshot.matches('paying'));
</script>

<template>
  <output>{{ total }}</output>
  <progress v-if="isPaying" />
</template>
```

The returned ref is a `shallowRef`. Templates unwrap it, so use `{{ total }}` in the template and `total.value` in script code.

## Arguments

| Argument | Description |
| --- | --- |
| `actor` | An actor reference, `undefined`, or a `Ref` holding either. |
| `selector` | `(snapshot) => value`. Receives `undefined` when there is no actor. |
| `compare` | Optional equality function. Defaults to `(a, b) => a === b`. |

The actor only needs `getSnapshot()` and `subscribe(...)`, so any actor reference works, including [invoked or spawned children](../invoke.md).

## Change detection

The ref is written only when `compare(previous, next)` returns `false`. Reference equality is the default, so a selector that builds a new object updates on every snapshot. Pass a comparison function in that case.

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

Prefer small selected values: a total, a name, a `snapshot.matches('uploading')` boolean. Selecting the whole snapshot updates every consumer on every transition.

## Selecting from child actors

Read a child from `snapshot.children` and select from it.

```ts
const { snapshot } = useActor(uploadMachine);
const uploadRef = snapshot.value.children.upload;
const progress = useSelector(uploadRef, (s) => s?.context.progress ?? 0);
```

Children come and go with the states that invoke them, so a child reference read once can become stale. Keep it in a ref and let `useSelector(...)` follow it.

## Reactive actor references

When the first argument is a `Ref`, the composable re-subscribes whenever the ref changes and immediately recomputes the selected value with the new actor. A ref holding `undefined` is supported: the selector is called with `undefined` and no subscription is made.

```ts
const currentUpload = shallowRef<ActorRefFrom<typeof uploadMachine>>();
const progress = useSelector(currentUpload, (s) => s?.context.progress ?? 0);
```

Swapping actors, such as a different upload or a different order, is therefore safe without recreating the component.

> **Warning:** There is no `useSelector` overload that takes actor logic. Create the actor with `useActor(...)` or `useActorRef(...)` first.

## TypeScript

The snapshot type is inferred from the actor reference. When the actor may be `undefined`, the snapshot parameter is `undefined` too, so handle that in the selector.

```ts
import type { SnapshotFrom } from 'xstate';

const selectTotal = (snapshot: SnapshotFrom<typeof checkoutMachine>) =>
  snapshot.context.total;

const total = useSelector(actorRef, selectTotal); // Ref<number>
```

## Selectors cheatsheet

```ts
useSelector(actorRef, (snapshot) => snapshot.context.count);
useSelector(actorRef, (snapshot) => snapshot.matches('loading'));
useSelector(actorRef, selector, (a, b) => a.id === b.id);
useSelector(actorRefRef, selector); // Ref<Actor | undefined>
```
